import { describe, it, expect, vi } from "vitest"
import { gradeOutputs, runFieldChecks } from "../lib/evals/grade"
import type { Check, ScenarioSpec } from "../lib/evals/spec"
import type { Judge } from "../lib/evals/types"

const scenario = (over: Partial<ScenarioSpec> = {}): ScenarioSpec => ({
  id: "s1",
  split: "DEV",
  theme: "t",
  weight: 1,
  input: "Some input",
  expected: { queue: "billing", level: "high" },
  why: "",
  ...over,
})

const spec = (checks: Check[]) => ({ checks })

describe("equals", () => {
  const checks = spec([{ field: "queue", type: "equals" }])

  it("passes when the value matches exactly", () => {
    expect(runFieldChecks(scenario(), { queue: "billing" }, checks, {})).toEqual({ passed: true, category: null, reason: null })
  })

  it("fails on a different value, naming the actual and the expected", () => {
    const r = runFieldChecks(scenario(), { queue: "shipping" }, checks, {})
    expect(r).toEqual({
      passed: false,
      category: "MISMATCH:queue",
      reason: 'Queue was "shipping", expected "billing".',
    })
  })

  it("ignores surrounding spaces, but is case-sensitive", () => {
    expect(runFieldChecks(scenario(), { queue: "  billing  " }, checks, {}).passed).toBe(true)
    expect(runFieldChecks(scenario(), { queue: "Billing" }, checks, {}).passed).toBe(false)
  })

  it("fails a missing or empty value, saying it was empty", () => {
    for (const output of [{}, { queue: "" }, { queue: "   " }] as Record<string, string>[]) {
      const r = runFieldChecks(scenario(), output, checks, {})
      expect(r.passed).toBe(false)
      expect(r.reason).toBe('Queue was empty, expected "billing".')
    }
  })
})

describe("oneOf", () => {
  const checks = spec([{ field: "level", type: "oneOf", values: ["low", "medium", "high"] }])

  it("passes a value in the set and fails one outside it, listing the allowed values", () => {
    expect(runFieldChecks(scenario(), { level: "medium" }, checks, {}).passed).toBe(true)
    const r = runFieldChecks(scenario(), { level: "extreme" }, checks, {})
    expect(r.category).toBe("NOT_ALLOWED:level")
    expect(r.reason).toBe('Level was "extreme", which is not one of: low, medium, high.')
  })

  it("fails an empty value", () => {
    expect(runFieldChecks(scenario(), { level: "" }, checks, {}).reason).toContain("was empty")
  })
})

describe("inReference", () => {
  const checks = spec([{ field: "queue", type: "inReference", list: "queues" }])
  const lists = { queues: ["billing", "shipping"] }

  it("passes a value in the environment's list and fails one that is not", () => {
    expect(runFieldChecks(scenario(), { queue: "billing" }, checks, lists).passed).toBe(true)
    const r = runFieldChecks(scenario(), { queue: "legal" }, checks, lists)
    expect(r.category).toBe("NOT_IN_REFERENCE:queue")
    expect(r.reason).toBe('Queue "legal" is not in this environment\'s "queues" list.')
  })

  it("fails an empty value", () => {
    expect(runFieldChecks(scenario(), { queue: "" }, checks, lists).passed).toBe(false)
  })

  it("fails clearly, without crashing, when the environment has no such list", () => {
    const r = runFieldChecks(scenario(), { queue: "billing" }, checks, {})
    expect(r.passed).toBe(false)
    expect(r.reason).toContain('no "queues" list')
  })

  it("treats an empty list as a list that allows nothing", () => {
    expect(runFieldChecks(scenario(), { queue: "billing" }, checks, { queues: [] }).passed).toBe(false)
  })

  it("does not let a value pass by being an inherited object property", () => {
    expect(runFieldChecks(scenario(), { queue: "constructor" }, checks, lists).passed).toBe(false)
  })
})

describe("nonEmpty", () => {
  const checks = spec([{ field: "rationale", type: "nonEmpty" }])

  it("passes any text, and fails missing, empty and blank values", () => {
    expect(runFieldChecks(scenario(), { rationale: "because" }, checks, {}).passed).toBe(true)
    for (const output of [{}, { rationale: "" }, { rationale: "  \n " }] as Record<string, string>[]) {
      const r = runFieldChecks(scenario(), output, checks, {})
      expect(r.category).toBe("EMPTY:rationale")
      expect(r.reason).toBe("Rationale is empty.")
    }
  })
})

describe("several checks", () => {
  const checks = spec([
    { field: "queue", type: "equals" },
    { field: "level", type: "equals" },
    { field: "queue", type: "inReference", list: "queues" },
    { field: "rationale", type: "nonEmpty" },
  ])
  const lists = { queues: ["billing"] }
  const good = { queue: "billing", level: "high", rationale: "x" }

  it("passes only when every check passes", () => {
    expect(runFieldChecks(scenario(), good, checks, lists).passed).toBe(true)
    expect(runFieldChecks(scenario(), { ...good, level: "low" }, checks, lists).passed).toBe(false)
  })

  it("reports every failing check in a sorted category and a combined reason", () => {
    const r = runFieldChecks(scenario(), { queue: "legal", level: "low", rationale: "" }, checks, lists)
    expect(r.category).toBe("EMPTY:rationale+MISMATCH:level+MISMATCH:queue+NOT_IN_REFERENCE:queue")
    expect(r.reason).toContain('was "legal", expected "billing"')
    expect(r.reason).toContain('was "low", expected "high"')
    expect(r.reason).toContain("is empty")
    expect(r.reason!.endsWith(".")).toBe(true)
  })

  it("gives the same category however the checks are ordered", () => {
    const reversed = spec([...checks.checks].reverse())
    const out = { queue: "legal", level: "low", rationale: "" }
    expect(runFieldChecks(scenario(), out, reversed, lists).category).toBe(runFieldChecks(scenario(), out, checks, lists).category)
  })

  it("does not repeat a category when two checks fail the same way", () => {
    const twice = spec([{ field: "queue", type: "equals" }, { field: "queue", type: "equals" }])
    expect(runFieldChecks(scenario(), { queue: "x" }, twice, {}).category).toBe("MISMATCH:queue")
  })
})

describe("gradeOutputs", () => {
  const scenarios: ScenarioSpec[] = [
    scenario({ id: "d1", split: "DEV", expected: { queue: "billing" } }),
    scenario({ id: "d2", split: "DEV", expected: { queue: "shipping" } }),
    scenario({ id: "h1", split: "HOLDOUT", expected: { queue: "billing" } }),
  ]
  const grading = {
    checks: [{ field: "queue", type: "equals" }, { field: "rationale", type: "nonEmpty" }] as Check[],
    scenarios,
    judge: { field: "rationale" },
  }
  const outputs = {
    d1: { queue: "billing", rationale: "ok" },
    d2: { queue: "wrong", rationale: "ok" },
    h1: { queue: "billing", rationale: "ok" },
  }

  it("grades every scenario and counts each split", async () => {
    const run = await gradeOutputs({ spec: grading, outputs, lists: {} })
    expect(run.rows.map((r) => [r.scenarioId, r.passed])).toEqual([["d1", true], ["d2", false], ["h1", true]])
    expect([run.devTotal, run.devPassed, run.holdoutTotal, run.holdoutPassed]).toEqual([2, 1, 1, 1])
  })

  it("carries the expected and actual values and the theme into each row", async () => {
    const run = await gradeOutputs({ spec: grading, outputs, lists: {} })
    expect(run.rows[1]).toMatchObject({ theme: "t", expected: { queue: "shipping" }, actual: { queue: "wrong", rationale: "ok" } })
  })

  it("treats a scenario with no output as failing, not as a crash", async () => {
    const run = await gradeOutputs({ spec: grading, outputs: {}, lists: {} })
    expect(run.devPassed).toBe(0)
    expect(run.rows.every((r) => !r.passed)).toBe(true)
  })

  it("handles a spec with no scenarios in a split", async () => {
    const run = await gradeOutputs({ spec: { ...grading, scenarios: [scenarios[0]] }, outputs, lists: {} })
    expect([run.holdoutTotal, run.holdoutPassed]).toEqual([0, 0])
  })

  describe("the judge", () => {
    const judgeWith = (score: Judge["score"]): Judge & { score: ReturnType<typeof vi.fn> } => ({ score: vi.fn(score) })

    it("scores only the scenarios that passed the checks, using the input and the named field", async () => {
      const judge = judgeWith(async () => ({ score: 5, note: "good" }))
      await gradeOutputs({ spec: grading, outputs, lists: {}, judge })
      expect(judge.score).toHaveBeenCalledTimes(2) // d1 and h1; d2 already failed
      expect(judge.score).toHaveBeenCalledWith("Some input", "ok")
    })

    it("is not used when the spec names no judge field", async () => {
      const judge = judgeWith(async () => ({ score: 5, note: "good" }))
      await gradeOutputs({ spec: { ...grading, judge: null }, outputs, lists: {}, judge })
      expect(judge.score).not.toHaveBeenCalled()
    })

    it("fails a scenario with a JUDGE category on a score below the pass mark, and passes the mark itself", async () => {
      const low = await gradeOutputs({ spec: grading, outputs, lists: {}, judge: judgeWith(async () => ({ score: 2, note: "vague" })) })
      expect(low.rows[0]).toMatchObject({ passed: false, category: "JUDGE:rationale", judgeScore: 2 })
      expect(low.rows[0].reason).toBe("The rationale scored 2/5 (pass is 3): vague")
      const atMark = await gradeOutputs({ spec: grading, outputs, lists: {}, judge: judgeWith(async () => ({ score: 3, note: "ok" })) })
      expect(atMark.rows[0].passed).toBe(true)
    })

    it("never fails a scenario because the judge threw or returned no score", async () => {
      const threw = await gradeOutputs({ spec: grading, outputs, lists: {}, judge: judgeWith(async () => { throw new Error("401") }) })
      expect(threw.rows[0]).toMatchObject({ passed: true, judgeScore: null })
      expect(threw.rows[0].judgeNote).toBe("Judge unavailable: 401")
      const none = await gradeOutputs({ spec: grading, outputs, lists: {}, judge: judgeWith(async () => ({ score: null, note: "unreadable" })) })
      expect(none.rows[0]).toMatchObject({ passed: true, judgeScore: null, judgeNote: "unreadable" })
    })

    it("leaves a scenario that failed the checks with no judge fields", async () => {
      const run = await gradeOutputs({ spec: grading, outputs, lists: {}, judge: judgeWith(async () => ({ score: 5, note: "x" })) })
      expect(run.rows[1]).toMatchObject({ judgeScore: null, judgeNote: null })
    })
  })
})
