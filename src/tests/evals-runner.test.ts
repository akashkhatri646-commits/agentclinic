import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { runEval, type EvalDb } from "../lib/evals/runner"
import { syncFailureModes } from "../lib/evals/triage-sync"
import { INTAKE_TRIAGE_ID, getSpecialistVersion } from "../lib/evals/specialists"
import { INTAKE_TRIAGE_SCENARIOS } from "../lib/evals/scenarios/intake-triage"
import { SEEDED_THERAPY_NAMES, THERAPY } from "../lib/evals/catalogue"
import type { Judge } from "../lib/evals/types"

// The triage sync has its own tests; here we only check that the runner calls it and survives its failure.
vi.mock("../lib/evals/triage-sync", () => ({ syncFailureModes: vi.fn(async () => ({ created: 0, updated: 0, verified: 0, reappeared: 0 })) }))

// The factory runs only if the module is actually imported, so this records whether the runner loaded the shared client.
const prismaLoaded = vi.hoisted(() => vi.fn())
vi.mock("../lib/prisma", () => {
  prismaLoaded()
  return { prisma: {} }
})

type CreateArgs = { data: Record<string, unknown> & { results: { create: Record<string, unknown>[] } } }

function fakeDb(therapies: string[] = SEEDED_THERAPY_NAMES) {
  const create = vi.fn(async ({ data }: CreateArgs) => ({
    id: "run-1",
    createdAt: new Date("2026-10-25T10:00:00Z"),
    ...data,
    results: data.results.create,
  }))
  const findMany = vi.fn(async () => therapies.map((name) => ({ name })))
  const db = { therapy: { findMany }, evalRun: { create } } as unknown as EvalDb
  return { db, create, findMany }
}

const run = (version: string, extra: Partial<Parameters<typeof runEval>[0]> = {}) => {
  const fake = fakeDb()
  return { fake, promise: runEval({ specialistId: INTAKE_TRIAGE_ID, version, db: fake.db, ...extra }) }
}

describe("runEval", () => {
  it("records one result per scenario, in a single nested write", async () => {
    const { fake, promise } = run("v2")
    const result = await promise
    expect(fake.create).toHaveBeenCalledTimes(1)
    expect(result.results).toHaveLength(INTAKE_TRIAGE_SCENARIOS.length)
    expect(result.results.map((r) => r.scenarioId)).toEqual(INTAKE_TRIAGE_SCENARIOS.map((s) => s.id))
  })

  it("loads the live therapy catalogue from the database", async () => {
    const { fake, promise } = run("v2")
    await promise
    expect(fake.findMany).toHaveBeenCalledTimes(1)
  })

  it("stores the specialist, version, counts, verdict and reason", async () => {
    const { promise } = run("v2")
    const r = await promise
    expect(r).toMatchObject({
      specialistId: INTAKE_TRIAGE_ID,
      version: "v2",
      status: "COMPLETED",
      devTotal: 24,
      holdoutTotal: 8,
    })
    expect(typeof r.verdictReason).toBe("string")
    expect(r.verdictReason.length).toBeGreaterThan(0)
  })

  it("records who triggered the run, or null", async () => {
    expect((await run("v2", { triggeredBy: "user-7" }).promise).triggeredBy).toBe("user-7")
    expect((await run("v2").promise).triggeredBy).toBeNull()
  })

  it("rejects an unknown version and writes nothing", async () => {
    const { fake, promise } = run("v9")
    await expect(promise).rejects.toThrow("Unknown specialist version")
    expect(fake.create).not.toHaveBeenCalled()
  })

  it("rejects an unknown specialist", async () => {
    const fake = fakeDb()
    await expect(runEval({ specialistId: "nope", version: "v1", db: fake.db })).rejects.toThrow(
      "Unknown specialist version"
    )
  })

  it("gives failed results a category and a reason, and passed results neither", async () => {
    const r = await run("v1").promise
    for (const row of r.results) {
      if (row.passed) {
        expect(row.category).toBeNull()
        expect(row.reason).toBeNull()
      } else {
        expect(row.category).not.toBeNull()
        expect((row.reason as string).length).toBeGreaterThan(0)
      }
    }
  })
})

describe("shipped specialist versions (pins the demo story)", () => {
  it("v1 FAILS: 12/24 dev, 3/8 hold-out", async () => {
    const r = await run("v1").promise
    expect(r.verdict).toBe("FAIL")
    expect([r.devPassed, r.devTotal, r.holdoutPassed, r.holdoutTotal]).toEqual([12, 24, 3, 8])
    expect(r.verdictReason).toContain("below the 85.0% threshold")
  })

  it("v2 PASSES: 22/24 dev, 7/8 hold-out", async () => {
    const r = await run("v2").promise
    expect(r.verdict).toBe("PASS")
    expect([r.devPassed, r.devTotal, r.holdoutPassed, r.holdoutTotal]).toEqual([22, 24, 7, 8])
  })

  it("v2 gets d23, d24 and h08 wrong and nothing else", async () => {
    const r = await run("v2").promise
    expect(r.results.filter((x) => !x.passed).map((x) => x.scenarioId)).toEqual(["d23", "d24", "h08"])
  })
})

describe("triage sync hook (Phase 9)", () => {
  beforeEach(() => vi.mocked(syncFailureModes).mockClear())

  it("syncs the triage backlog once, with the stored run and the same database client", async () => {
    const fake = fakeDb()
    const r = await runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v2", db: fake.db })
    expect(syncFailureModes).toHaveBeenCalledTimes(1)
    const [run, db] = vi.mocked(syncFailureModes).mock.calls[0]
    expect(run).toBe(r)
    expect(db).toBe(fake.db)
  })

  it("syncs after the run is stored, never before", async () => {
    const fake = fakeDb()
    vi.mocked(syncFailureModes).mockImplementationOnce(async () => {
      expect(fake.create).toHaveBeenCalledTimes(1)
      return { created: 0, updated: 0, verified: 0, reappeared: 0 }
    })
    await runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v2", db: fake.db })
  })

  it("still returns the stored run, and logs, when the sync fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(syncFailureModes).mockRejectedValueOnce(new Error("no such table: FailureMode"))
    const r = await run("v2").promise
    expect(r.verdict).toBe("PASS")
    expect(r.results).toHaveLength(32)
    expect(spy).toHaveBeenCalledWith("Failed to update the triage backlog after an eval run", expect.any(Error))
    spy.mockRestore()
  })

  it("does not sync when the run could not be stored", async () => {
    const fake = fakeDb()
    fake.create.mockRejectedValueOnce(new Error("db down"))
    await expect(runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v2", db: fake.db })).rejects.toThrow("db down")
    expect(syncFailureModes).not.toHaveBeenCalled()
  })

  it("does not sync for an unknown version", async () => {
    await expect(runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v9", db: fakeDb().db })).rejects.toThrow()
    expect(syncFailureModes).not.toHaveBeenCalled()
  })
})

describe("loop-time timestamps (Phase 8)", () => {
  afterEach(() => vi.useRealTimers())

  it("records change shipped, started and finished for a real run", async () => {
    const before = Date.now()
    const r = await run("v2").promise
    expect(r.changeShippedAt).toEqual(getSpecialistVersion(INTAKE_TRIAGE_ID, "v2")!.releasedAt)
    expect(r.startedAt!.getTime()).toBeGreaterThanOrEqual(before)
    expect(r.finishedAt!.getTime()).toBeGreaterThanOrEqual(r.startedAt!.getTime())
    expect(r.changeShippedAt!.getTime()).toBeLessThanOrEqual(r.startedAt!.getTime())
  })

  it("never marks a real run as sample", async () => {
    expect((await run("v2").promise).isSample).toBe(false)
  })

  it("takes the verdict time after the judge has finished", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"))
    const slowJudge: Judge = {
      score: vi.fn(async () => {
        vi.setSystemTime(Date.now() + 60_000) // each judge call takes a minute
        return { score: 5, note: "ok" }
      }),
    }
    const r = await run("v2", { judge: slowJudge }).promise
    expect(r.startedAt!.toISOString()).toBe("2026-11-01T10:00:00.000Z")
    expect(r.finishedAt!.getTime() - r.startedAt!.getTime()).toBe(29 * 60_000)
  })

  describe("explicit timing (used by the seed)", () => {
    const timing = {
      changeShippedAt: new Date("2026-09-01T09:00:00Z"),
      startedAt: new Date("2026-09-22T09:00:00Z"),
      finishedAt: new Date("2026-09-22T09:05:00Z"),
    }

    it("stores the supplied timestamps and the sample flag", async () => {
      const r = await run("v1", { timing, isSample: true }).promise
      expect(r.changeShippedAt).toEqual(timing.changeShippedAt)
      expect(r.startedAt).toEqual(timing.startedAt)
      expect(r.finishedAt).toEqual(timing.finishedAt)
      expect(r.isSample).toBe(true)
    })

    it("sets createdAt to the finish time so list order and previous-version lookup agree", async () => {
      const fake = fakeDb()
      await runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v1", db: fake.db, timing, isSample: true })
      expect((fake.create.mock.calls[0][0] as CreateArgs).data.createdAt).toEqual(timing.finishedAt)
    })

    it("leaves createdAt to the database for a real run", async () => {
      const fake = fakeDb()
      await runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v1", db: fake.db })
      expect((fake.create.mock.calls[0][0] as CreateArgs).data).not.toHaveProperty("createdAt")
    })

    it("rejects a run that starts before its change shipped, and writes nothing", async () => {
      const fake = fakeDb()
      await expect(
        runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v1", db: fake.db, timing: { ...timing, startedAt: new Date("2026-08-01T00:00:00Z") } })
      ).rejects.toThrow("before its change shipped")
      expect(fake.create).not.toHaveBeenCalled()
    })

    it("rejects a run that finishes before it started", async () => {
      const fake = fakeDb()
      await expect(
        runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v1", db: fake.db, timing: { ...timing, finishedAt: new Date("2026-09-21T00:00:00Z") } })
      ).rejects.toThrow("before it started")
    })

    it("accepts zero-length stages (shipped, started and finished at the same moment)", async () => {
      const t = new Date("2026-09-01T09:00:00Z")
      const r = await run("v1", { timing: { changeShippedAt: t, startedAt: t, finishedAt: t } }).promise
      expect(r.finishedAt).toEqual(t)
    })
  })
})

describe("database client (review finding #6)", () => {
  beforeEach(() => prismaLoaded.mockClear())

  it("does not load the shared client when one is supplied", async () => {
    await run("v2").promise
    expect(prismaLoaded).not.toHaveBeenCalled()
  })

  it("does not load the shared client for an unknown version", async () => {
    await expect(runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v9" })).rejects.toThrow("Unknown")
    expect(prismaLoaded).not.toHaveBeenCalled()
  })

  it("loads the shared client only when none is supplied", async () => {
    await expect(runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v2" })).rejects.toThrow()
    expect(prismaLoaded).toHaveBeenCalledTimes(1)
  })
})

describe("environment handling", () => {
  it("fails scenarios whose therapy was removed from the catalogue, without crashing", async () => {
    const fake = fakeDb(SEEDED_THERAPY_NAMES.filter((n) => n !== THERAPY.TOKEN_BUDGET_RELIEF))
    const r = await runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v2", db: fake.db })
    const missing = r.results.filter((x) => x.category === "THERAPY_NOT_IN_CATALOGUE")
    expect(missing.length).toBeGreaterThan(0)
    expect(missing.every((x) => x.actualTherapy === THERAPY.TOKEN_BUDGET_RELIEF)).toBe(true)
    expect(r.verdict).toBe("FAIL")
  })

  it("handles an empty catalogue as a failed environment", async () => {
    const fake = fakeDb([])
    const r = await runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v2", db: fake.db })
    expect(r.verdict).toBe("FAIL")
    expect(r.devPassed + r.holdoutPassed).toBe(0)
    expect(r.verdictReason).toContain("catalogue is empty")
    expect(r.results.every((x) => x.category === "THERAPY_NOT_IN_CATALOGUE")).toBe(true)
  })
})

describe("optional judge", () => {
  let judge: Judge & { score: ReturnType<typeof vi.fn> }
  beforeEach(() => {
    judge = { score: vi.fn(async () => ({ score: 5, note: "Grounded." })) }
  })

  it("does not run, and is recorded as disabled, when no judge is given", async () => {
    const r = await run("v2").promise
    expect(r.judgeEnabled).toBe(false)
    expect(r.results.every((x) => x.judgeScore === null)).toBe(true)
  })

  it("scores only scenarios that already passed the deterministic checks", async () => {
    const r = await run("v2", { judge }).promise
    expect(r.judgeEnabled).toBe(true)
    expect(judge.score).toHaveBeenCalledTimes(29) // 32 scenarios minus 3 deterministic failures
    const failed = r.results.filter((x) => ["d23", "d24", "h08"].includes(x.scenarioId))
    expect(failed.every((x) => x.judgeScore === null)).toBe(true)
  })

  it("keeps passing scenarios passing on a high score", async () => {
    const r = await run("v2", { judge }).promise
    expect(r.verdict).toBe("PASS")
    expect(r.results.find((x) => x.scenarioId === "d01")).toMatchObject({ passed: true, judgeScore: 5 })
  })

  it("fails a scenario with category RATIONALE on a low score", async () => {
    judge.score.mockResolvedValue({ score: 2, note: "Generic." })
    const r = await run("v2", { judge }).promise
    const row = r.results.find((x) => x.scenarioId === "d01")!
    expect(row.passed).toBe(false)
    expect(row.category).toBe("RATIONALE")
    expect(row.reason).toContain("scored 2/5")
    expect(r.verdict).toBe("FAIL")
  })

  it("treats a score of exactly 3 as a pass", async () => {
    judge.score.mockResolvedValue({ score: 3, note: "Adequate." })
    const r = await run("v2", { judge }).promise
    expect(r.results.find((x) => x.scenarioId === "d01")!.passed).toBe(true)
  })

  it("is non-fatal when the judge throws: the scenario keeps its deterministic result", async () => {
    judge.score.mockRejectedValue(new Error("network down"))
    const r = await run("v2", { judge }).promise
    const row = r.results.find((x) => x.scenarioId === "d01")!
    expect(row.passed).toBe(true)
    expect(row.judgeScore).toBeNull()
    expect(row.judgeNote).toContain("Judge unavailable: network down")
    expect(r.verdict).toBe("PASS")
  })

  it("says so in the verdict reason when the judge is on but scores nothing (review finding #3)", async () => {
    judge.score.mockRejectedValue(new Error("401 invalid key"))
    const r = await run("v2", { judge }).promise
    expect(r.judgeEnabled).toBe(true)
    expect(r.verdictReason).toContain("scored only 0 of 29 rationales")
    expect(r.verdictReason).toContain("not graded")
  })

  it("says so when the judge scores only some rationales", async () => {
    let calls = 0
    judge.score.mockImplementation(async () =>
      ++calls % 2 === 0 ? { score: null, note: "Malformed reply." } : { score: 5, note: "Grounded." }
    )
    const r = await run("v2", { judge }).promise
    expect(r.verdictReason).toContain("scored only 15 of 29 rationales")
  })

  it("adds no warning when the judge scored everything it was asked about", async () => {
    const r = await run("v2", { judge }).promise
    expect(r.verdictReason).not.toContain("not graded")
  })

  it("adds no warning when the judge was never asked (every scenario failed the checks)", async () => {
    const fake = fakeDb([])
    const r = await runEval({ specialistId: INTAKE_TRIAGE_ID, version: "v2", db: fake.db, judge })
    expect(judge.score).not.toHaveBeenCalled()
    expect(r.verdictReason).not.toContain("not graded")
  })

  it("adds no warning when no judge is used", async () => {
    const r = await run("v2").promise
    expect(r.verdictReason).not.toContain("judge")
  })

  it("is non-fatal when the judge returns no score", async () => {
    judge.score.mockResolvedValue({ score: null, note: "Malformed reply." })
    const r = await run("v2", { judge }).promise
    const row = r.results.find((x) => x.scenarioId === "d01")!
    expect(row).toMatchObject({ passed: true, judgeScore: null, judgeNote: "Malformed reply." })
  })
})
