import { describe, it, expect, vi, beforeEach } from "vitest"
import { runEval, type EvalDb } from "../lib/evals/runner"
import { INTAKE_TRIAGE_ID } from "../lib/evals/specialists"
import { INTAKE_TRIAGE_SCENARIOS } from "../lib/evals/scenarios/intake-triage"
import { SEEDED_THERAPY_NAMES, THERAPY } from "../lib/evals/catalogue"
import type { Judge } from "../lib/evals/types"

vi.mock("../lib/prisma", () => ({ prisma: {} }))

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

  it("is non-fatal when the judge returns no score", async () => {
    judge.score.mockResolvedValue({ score: null, note: "Malformed reply." })
    const r = await run("v2", { judge }).promise
    const row = r.results.find((x) => x.scenarioId === "d01")!
    expect(row).toMatchObject({ passed: true, judgeScore: null, judgeNote: "Malformed reply." })
  })
})
