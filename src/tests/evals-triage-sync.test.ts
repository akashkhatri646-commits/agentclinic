import { describe, it, expect, vi } from "vitest"
import { syncFailureModes, type SyncableRun, type TriageDb } from "../lib/evals/triage-sync"
import { INTAKE_TRIAGE_SCENARIOS as scenarios } from "../lib/evals/scenarios/intake-triage"

const at = (iso: string) => new Date(iso)
const V1_FAIL = ["d05", "d06", "d07", "d11", "d12", "d13", "d16", "d17", "d19", "d21", "d22", "d23", "h01", "h02", "h04", "h05", "h08"]
const V2_FAIL = ["d23", "d24", "h08"]
const results = (fail: string[]) => scenarios.map((s) => ({ scenarioId: s.id, passed: !fail.includes(s.id) }))

function makeRun(version: string, fail: string[], over: Partial<SyncableRun> = {}): SyncableRun {
  return {
    id: `run-${version}`,
    specialistId: "intake-triage",
    version,
    createdAt: at("2026-10-22T09:04:00Z"),
    finishedAt: at("2026-10-22T09:04:00Z"),
    results: results(fail),
    ...over,
  }
}

type ModeRow = Record<string, unknown>
const modeRow = (over: ModeRow = {}): ModeRow => ({
  id: "m-eg",
  theme: "expectation-gap",
  status: "OPEN",
  frequency: 5,
  failingScenarioIds: JSON.stringify(["d11", "d12", "d13", "d22", "h04"]),
  regressedScenarioIds: "[]",
  suggestedSeverity: 3,
  lastRunId: "run-v1",
  lastRunVersion: "v1",
  ...over,
})
const fixRow = (over: ModeRow = {}): ModeRow => ({
  id: "f1",
  failureModeId: "m-eg",
  title: "Add expectation rules",
  status: "SHIPPED",
  shippedVersion: "v2",
  ownerId: "alice",
  isSample: false,
  ...over,
})

function mockDb(opts: { modes?: ModeRow[]; fixes?: ModeRow[]; previousRun?: unknown } = {}) {
  const failureMode = {
    findMany: vi.fn(async () => opts.modes ?? []),
    create: vi.fn((args: unknown) => ({ op: "mode.create", args })),
    update: vi.fn((args: unknown) => ({ op: "mode.update", args })),
  }
  const fix = {
    findMany: vi.fn(async () => opts.fixes ?? []),
    update: vi.fn((args: unknown) => ({ op: "fix.update", args })),
  }
  const fixEvent = { create: vi.fn((args: unknown) => ({ op: "event.create", args })) }
  const evalRun = { findFirst: vi.fn(async () => opts.previousRun ?? null) }
  const notification = { create: vi.fn(async () => ({})) }
  const $transaction = vi.fn(async (ops: unknown[]) => ops)
  const db = { failureMode, fix, fixEvent, evalRun, notification, $transaction } as unknown as TriageDb
  return { db, failureMode, fix, fixEvent, evalRun, notification, $transaction }
}

describe("syncFailureModes: nothing to do", () => {
  it("returns an empty summary and writes nothing for an unknown version", async () => {
    const m = mockDb()
    expect(await syncFailureModes(makeRun("v9", V1_FAIL), m.db)).toEqual({ created: 0, updated: 0, verified: 0, reappeared: 0 })
    expect(m.$transaction).not.toHaveBeenCalled()
    expect(m.failureMode.findMany).not.toHaveBeenCalled()
  })

  it("returns an empty summary and writes nothing for an unknown specialist", async () => {
    const m = mockDb()
    await syncFailureModes(makeRun("v1", V1_FAIL, { specialistId: "nope" }), m.db)
    expect(m.$transaction).not.toHaveBeenCalled()
  })

  it("writes nothing when the plan is empty (a clean run and no stored modes)", async () => {
    const m = mockDb()
    const summary = await syncFailureModes(makeRun("v1", []), m.db)
    expect(summary).toEqual({ created: 0, updated: 0, verified: 0, reappeared: 0 })
    expect(m.$transaction).not.toHaveBeenCalled()
    expect(m.notification.create).not.toHaveBeenCalled()
  })
})

describe("syncFailureModes: creating modes", () => {
  it("creates one open mode per failing theme, with ids stored as sorted JSON text", async () => {
    const m = mockDb()
    const summary = await syncFailureModes(makeRun("v1", V1_FAIL, { finishedAt: at("2026-09-22T09:05:00Z") }), m.db)
    expect(summary.created).toBe(8)
    expect(m.failureMode.create).toHaveBeenCalledTimes(8)
    const eg = m.failureMode.create.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data).find((d) => d.theme === "expectation-gap")!
    expect(eg).toMatchObject({
      specialistId: "intake-triage",
      status: "OPEN",
      frequency: 5,
      totalScenarios: 5,
      suggestedSeverity: 3,
      lastRunId: "run-v1",
      lastRunVersion: "v1",
      failingScenarioIds: '["d11","d12","d13","d22","h04"]',
      regressedScenarioIds: "[]",
    })
    expect(eg.firstSeenAt).toEqual(at("2026-09-22T09:05:00Z"))
    expect(eg).not.toHaveProperty("effort") // left to the database default
  })

  it("writes everything in a single transaction", async () => {
    const m = mockDb()
    await syncFailureModes(makeRun("v1", V1_FAIL), m.db)
    expect(m.$transaction).toHaveBeenCalledTimes(1)
    expect((m.$transaction.mock.calls[0][0] as unknown[]).length).toBe(8)
  })

  it("looks for the previous version's run to find regressed scenarios, and not for the first version", async () => {
    const first = mockDb()
    await syncFailureModes(makeRun("v1", V1_FAIL), first.db)
    expect(first.evalRun.findFirst).not.toHaveBeenCalled()

    const second = mockDb({ previousRun: { results: results(V1_FAIL) } })
    await syncFailureModes(makeRun("v2", V2_FAIL), second.db)
    expect(second.evalRun.findFirst).toHaveBeenCalledTimes(1)
    const where = (second.evalRun.findFirst.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where
    expect(where).toMatchObject({ specialistId: "intake-triage", version: "v1" })
  })

  it("records the regressed scenario found against the previous version", async () => {
    const m = mockDb({ previousRun: { results: results(V1_FAIL) } })
    await syncFailureModes(makeRun("v2", V2_FAIL), m.db)
    const sarcasm = m.failureMode.create.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data).find((d) => d.theme === "sarcasm-and-idiom")!
    expect(sarcasm.regressedScenarioIds).toBe('["d24"]')
  })

  it("falls back to createdAt when a run has no finish time", async () => {
    const m = mockDb()
    await syncFailureModes(makeRun("v1", V1_FAIL, { finishedAt: null, createdAt: at("2026-01-02T00:00:00Z") }), m.db)
    const d = (m.failureMode.create.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(d.firstSeenAt).toEqual(at("2026-01-02T00:00:00Z"))
  })
})

describe("syncFailureModes: updating modes", () => {
  it("resolves a mode and clears its reappeared flag, writing the resolved time", async () => {
    const m = mockDb({ modes: [modeRow()] })
    const summary = await syncFailureModes(makeRun("v2", V2_FAIL), m.db)
    expect(summary.updated).toBe(1)
    const data = (m.failureMode.update.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(data).toMatchObject({ status: "RESOLVED", frequency: 0, failingScenarioIds: "[]", reappeared: false })
    expect(data.resolvedAt).toEqual(at("2026-10-22T09:04:00Z"))
  })

  it("does not write history fields it was not asked to change (resolvedAt, reappeared)", async () => {
    const m = mockDb({ modes: [modeRow({ status: "RESOLVED", frequency: 0, failingScenarioIds: "[]", lastRunVersion: "v1", lastRunId: "run-v1" })] })
    await syncFailureModes(makeRun("v2", V2_FAIL), m.db)
    const data = (m.failureMode.update.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(data).toMatchObject({ status: "RESOLVED", lastRunVersion: "v2" })
    expect(data).not.toHaveProperty("resolvedAt")
    expect(data).not.toHaveProperty("reappeared")
    expect(data).not.toHaveProperty("reappearedAt")
  })

  it("reopens a resolved mode that fails again and flags it", async () => {
    const m = mockDb({ modes: [modeRow({ status: "RESOLVED", frequency: 0, failingScenarioIds: "[]", lastRunVersion: "v2" })] })
    const summary = await syncFailureModes(makeRun("v2", ["d11", "d12"], { finishedAt: at("2026-10-30T10:00:00Z") }), m.db)
    expect(summary.reappeared).toBe(1)
    const data = (m.failureMode.update.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(data).toMatchObject({ status: "OPEN", frequency: 2, resolvedAt: null, reappeared: true })
    expect(data.reappearedAt).toEqual(at("2026-10-30T10:00:00Z"))
  })

  it("leaves a mode alone for a run of an older version", async () => {
    const m = mockDb({ modes: [modeRow({ status: "RESOLVED", frequency: 0, failingScenarioIds: "[]", lastRunVersion: "v2" })] })
    await syncFailureModes(makeRun("v1", V1_FAIL), m.db)
    expect(m.failureMode.update).not.toHaveBeenCalled()
  })

  it("treats a stored list that is not valid JSON as empty instead of failing", async () => {
    const m = mockDb({ modes: [modeRow({ failingScenarioIds: "not json", regressedScenarioIds: "{bad" })] })
    await expect(syncFailureModes(makeRun("v1", V1_FAIL), m.db)).resolves.toBeDefined()
  })
})

describe("syncFailureModes: verifying fixes", () => {
  const resolvedRun = () => makeRun("v2", V2_FAIL, { finishedAt: at("2026-10-22T09:04:00Z") })

  it("marks the fix verified by this run, at the run's finish time, and records a system event", async () => {
    const m = mockDb({ modes: [modeRow()], fixes: [fixRow()] })
    const summary = await syncFailureModes(resolvedRun(), m.db)
    expect(summary.verified).toBe(1)
    expect(m.fix.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { status: "VERIFIED", verifiedAt: at("2026-10-22T09:04:00Z"), verifiedByRunId: "run-v2" },
    })
    const event = (m.fixEvent.create.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(event).toMatchObject({ fixId: "f1", actorId: null, kind: "VERIFIED", fromStatus: "SHIPPED", toStatus: "VERIFIED" })
    expect(event.at).toEqual(at("2026-10-22T09:04:00Z"))
  })

  it("loads only shipped and verified fixes for this specialist", async () => {
    const m = mockDb({ modes: [modeRow()], fixes: [fixRow()] })
    await syncFailureModes(resolvedRun(), m.db)
    expect(m.fix.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { failureMode: { specialistId: "intake-triage" }, status: { in: ["SHIPPED", "VERIFIED"] } },
      })
    )
  })

  it("does not verify a fix whose scenarios still fail", async () => {
    const m = mockDb({
      modes: [modeRow({ theme: "sarcasm-and-idiom", id: "m-s", frequency: 2, failingScenarioIds: '["d23","d24"]' })],
      fixes: [fixRow({ failureModeId: "m-s" })],
    })
    const summary = await syncFailureModes(resolvedRun(), m.db)
    expect(summary.verified).toBe(0)
    expect(m.fix.update).not.toHaveBeenCalled()
  })

  it("writes the status change and its event together in the same transaction", async () => {
    const m = mockDb({ modes: [modeRow()], fixes: [fixRow()] })
    await syncFailureModes(resolvedRun(), m.db)
    const ops = (m.$transaction.mock.calls[0][0] as { op: string }[]).map((o) => o.op)
    expect(ops).toContain("fix.update")
    expect(ops).toContain("event.create")
    expect(m.$transaction).toHaveBeenCalledTimes(1)
  })
})

describe("syncFailureModes: notifications", () => {
  const resolvedRun = () => makeRun("v2", V2_FAIL)

  it("tells the owner when their fix is verified, linking to the failure mode", async () => {
    const m = mockDb({ modes: [modeRow()], fixes: [fixRow()] })
    await syncFailureModes(resolvedRun(), m.db)
    expect(m.notification.create).toHaveBeenCalledTimes(1)
    expect(m.notification.create).toHaveBeenCalledWith({
      data: { userId: "alice", message: 'Your fix "Add expectation rules" was verified by a v2 run.', href: "/dashboard/triage/m-eg" },
    })
  })

  it("tells nobody when the fix has no owner", async () => {
    const m = mockDb({ modes: [modeRow()], fixes: [fixRow({ ownerId: null })] })
    await syncFailureModes(resolvedRun(), m.db)
    expect(m.notification.create).not.toHaveBeenCalled()
  })

  it("sends nothing for sample fixes, so a fresh install is not filled with invented events", async () => {
    const m = mockDb({ modes: [modeRow()], fixes: [fixRow({ isSample: true })] })
    const summary = await syncFailureModes(resolvedRun(), m.db)
    expect(summary.verified).toBe(1) // still verified
    expect(m.notification.create).not.toHaveBeenCalled()
  })

  it("tells each owner of a verified fix, once, when its failure mode reappears", async () => {
    const m = mockDb({
      modes: [modeRow({ status: "RESOLVED", frequency: 0, failingScenarioIds: "[]", lastRunVersion: "v2" })],
      fixes: [
        fixRow({ id: "f1", status: "VERIFIED", ownerId: "alice" }),
        fixRow({ id: "f2", status: "VERIFIED", ownerId: "alice" }),
        fixRow({ id: "f3", status: "VERIFIED", ownerId: "bob", isSample: true }),
      ],
    })
    await syncFailureModes(makeRun("v2", ["d11"]), m.db)
    expect(m.notification.create).toHaveBeenCalledTimes(1)
    expect(m.notification.create).toHaveBeenCalledWith({
      data: { userId: "alice", message: '"Human expectation gaps" has reappeared after it was fixed.', href: "/dashboard/triage/m-eg" },
    })
  })

  it("does not throw, and still writes the data, when a notification cannot be created", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const m = mockDb({ modes: [modeRow()], fixes: [fixRow()] })
    m.notification.create.mockRejectedValue(new Error("db down"))
    await expect(syncFailureModes(resolvedRun(), m.db)).resolves.toMatchObject({ verified: 1 })
    expect(m.$transaction).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("sends no notification when the transaction fails, because nothing was saved", async () => {
    const m = mockDb({ modes: [modeRow()], fixes: [fixRow()] })
    m.$transaction.mockRejectedValue(new Error("write failed"))
    await expect(syncFailureModes(resolvedRun(), m.db)).rejects.toThrow("write failed")
    expect(m.notification.create).not.toHaveBeenCalled()
  })
})

describe("syncFailureModes: failures are reported to the caller", () => {
  it("throws when the stored state cannot be read, so the runner can log it", async () => {
    const m = mockDb()
    m.failureMode.findMany.mockRejectedValue(new Error("no such table: FailureMode"))
    await expect(syncFailureModes(makeRun("v1", V1_FAIL), m.db)).rejects.toThrow("no such table")
  })
})
