import { describe, it, expect, vi, beforeEach } from "vitest"
import { ALL_INSTANCES, EVAL_ERROR_MESSAGES, isEvalErrorCode, startEvalRun } from "../lib/evals/start"
import { runEval, type EvalDb } from "../lib/evals/runner"
import { createAnthropicJudge, isJudgeConfigured } from "../lib/evals/judge"
import { SEEDED_INSTANCES } from "../lib/evals/instances"
import { intakeTriageRow, specialistRow } from "./support/specialist-rows"
import { intakeTriageSpec } from "../lib/evals/builtin-spec"

vi.mock("../lib/evals/runner", () => ({ runEval: vi.fn() }))
vi.mock("../lib/evals/judge", () => ({
  createAnthropicJudge: vi.fn(),
  isJudgeConfigured: vi.fn(),
}))

/** A database with the seeded intake-triage specialist (v1, v2 from code), one imported specialist, and the three instances. */
function fakeDb() {
  const imported = specialistRow({ ...intakeTriageSpec, slug: "ticket-router" }, [
    { label: "v1", releasedAt: new Date("2026-10-01T00:00:00Z"), builtinKey: null },
  ])
  const db = {
    specialistEvent: { create: vi.fn(async () => ({})) },
    specialist: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) =>
        where.slug === "intake-triage" ? intakeTriageRow() : where.slug === "ticket-router" ? imported : null
      ),
    },
    instance: {
      findMany: vi.fn(async () =>
        SEEDED_INSTANCES.map((i) => ({ ...i, referenceLists: i.referenceLists ? JSON.stringify(i.referenceLists) : null }))
      ),
    },
  } as unknown as EvalDb
  return db
}

const input = {
  role: "STAFF",
  userId: "user-1",
  specialist: "intake-triage",
  version: "v2",
  instance: "standard-clinic",
  useJudge: false,
}
const start = (over: Partial<typeof input> = {}) => startEvalRun({ ...input, ...over, db: fakeDb() })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(runEval).mockResolvedValue({ id: "run-9" } as never)
  vi.mocked(isJudgeConfigured).mockReturnValue(false)
})

describe("startEvalRun access", () => {
  it.each([["STAFF"], ["ADMIN"]])("lets %s start a run", async (role) => {
    expect(await start({ role })).toEqual({ ok: true, runId: "run-9", runIds: ["run-9"] })
  })

  it.each([["AGENT"], [""], ["staff"], ["SUPERUSER"]])(
    "rejects role %j and never runs anything",
    async (role) => {
      expect(await start({ role })).toEqual({ ok: false, code: "forbidden" })
      expect(runEval).not.toHaveBeenCalled()
    }
  )
})

describe("startEvalRun validation", () => {
  it.each([["v9"], [""], ["V2"], ["v2 "]])("rejects the unknown version %j", async (version) => {
    expect(await start({ version })).toEqual({ ok: false, code: "unknown-version" })
    expect(runEval).not.toHaveBeenCalled()
  })

  it.each([["nope"], [""], ["Intake-Triage"], ["__proto__"]])("rejects the unknown specialist %j", async (specialist) => {
    expect(await start({ specialist })).toEqual({ ok: false, code: "unknown-specialist" })
    expect(runEval).not.toHaveBeenCalled()
  })

  it.each([["nowhere"], [""], ["Standard-Clinic"]])("rejects the unknown instance %j", async (instance) => {
    expect(await start({ instance })).toEqual({ ok: false, code: "unknown-instance" })
    expect(runEval).not.toHaveBeenCalled()
  })

  it("asks for outputs, and runs nothing, for a version that does not run from code", async () => {
    expect(await start({ specialist: "ticket-router", version: "v1" })).toEqual({ ok: false, code: "needs-outputs" })
    expect(runEval).not.toHaveBeenCalled()
  })

  it("records who triggered the run, and on which instance", async () => {
    await start({ instance: "short-staffed-clinic" })
    expect(runEval).toHaveBeenCalledWith(
      expect.objectContaining({ specialistId: "intake-triage", version: "v2", instance: "short-staffed-clinic", triggeredBy: "user-1" })
    )
  })

  it("runs once on every instance, in order, for 'all'", async () => {
    vi.mocked(runEval).mockResolvedValueOnce({ id: "r1" } as never).mockResolvedValueOnce({ id: "r2" } as never).mockResolvedValueOnce({ id: "r3" } as never)
    const result = await start({ instance: ALL_INSTANCES })
    expect(result).toEqual({ ok: true, runId: "r3", runIds: ["r1", "r2", "r3"] })
    expect(vi.mocked(runEval).mock.calls.map((c) => c[0].instance)).toEqual(SEEDED_INSTANCES.map((i) => i.slug))
  })

  it("records who started the run on the specialist, after it succeeds", async () => {
    const db = fakeDb()
    await startEvalRun({ ...input, db })
    const events = (db as unknown as { specialistEvent: { create: ReturnType<typeof vi.fn> } }).specialistEvent.create
    expect(events).toHaveBeenCalledWith({ data: { specialistId: "sp-intake-triage", type: "RUN_STARTED", actorId: "user-1", actorRole: "STAFF" } })
  })

  it("does not fail the run when the event cannot be recorded", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const db = fakeDb()
    ;(db as unknown as { specialistEvent: { create: ReturnType<typeof vi.fn> } }).specialistEvent.create.mockRejectedValue(new Error("x"))
    expect((await startEvalRun({ ...input, db })).ok).toBe(true)
    spy.mockRestore()
  })

  it("says some runs were saved, and records them, when a later instance fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(runEval).mockResolvedValueOnce({ id: "r1" } as never).mockResolvedValueOnce({ id: "r2" } as never).mockRejectedValueOnce(new Error("judge down"))
    const db = fakeDb()
    expect(await startEvalRun({ ...input, instance: ALL_INSTANCES, db })).toEqual({ ok: false, code: "partial-run" })
    const events = (db as unknown as { specialistEvent: { create: ReturnType<typeof vi.fn> } }).specialistEvent.create
    expect(events).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it("is a plain failure, with no event, when the very first run fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(runEval).mockRejectedValueOnce(new Error("db down"))
    const db = fakeDb()
    expect(await startEvalRun({ ...input, instance: ALL_INSTANCES, db })).toEqual({ ok: false, code: "run-failed" })
    expect((db as unknown as { specialistEvent: { create: ReturnType<typeof vi.fn> } }).specialistEvent.create).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("reports run-failed, without throwing, when the runner fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(runEval).mockRejectedValue(new Error("db down"))
    expect(await start()).toEqual({ ok: false, code: "run-failed" })
    spy.mockRestore()
  })
})

describe("startEvalRun judge", () => {
  it("does not create a judge when it was not requested", async () => {
    vi.mocked(isJudgeConfigured).mockReturnValue(true)
    await start({ useJudge: false })
    expect(createAnthropicJudge).not.toHaveBeenCalled()
    expect(vi.mocked(runEval).mock.calls[0][0].judge).toBeNull()
  })

  it("ignores the request when no judge is configured", async () => {
    await start({ useJudge: true })
    expect(createAnthropicJudge).not.toHaveBeenCalled()
    expect(vi.mocked(runEval).mock.calls[0][0].judge).toBeNull()
  })

  it("passes a judge when requested and configured", async () => {
    const judge = { score: vi.fn() }
    vi.mocked(isJudgeConfigured).mockReturnValue(true)
    vi.mocked(createAnthropicJudge).mockResolvedValue(judge)
    await start({ useJudge: true })
    expect(vi.mocked(runEval).mock.calls[0][0].judge).toBe(judge)
  })
})

describe("error codes", () => {
  it("has a fixed message for every code", () => {
    for (const message of Object.values(EVAL_ERROR_MESSAGES)) expect(message.length).toBeGreaterThan(10)
  })

  it("only recognises known codes, so arbitrary query text is never shown", () => {
    expect(isEvalErrorCode("forbidden")).toBe(true)
    expect(isEvalErrorCode("run-failed")).toBe(true)
    expect(isEvalErrorCode("needs-outputs")).toBe(true)
    expect(isEvalErrorCode("partial-run")).toBe(true)
    expect(isEvalErrorCode("Your session expired, call support")).toBe(false)
    expect(isEvalErrorCode("toString")).toBe(false)
    expect(isEvalErrorCode("__proto__")).toBe(false)
    expect(isEvalErrorCode(undefined)).toBe(false)
  })
})
