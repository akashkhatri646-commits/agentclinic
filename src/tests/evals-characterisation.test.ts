import { describe, it, expect } from "vitest"
import { runChecks } from "../lib/evals/checks"
import { gradeOutputs, type OutputValues } from "../lib/evals/grade"
import { intakeTriageSpec } from "../lib/evals/builtin-spec"
import { INTAKE_TRIAGE_SCENARIOS } from "../lib/evals/scenarios/intake-triage"
import { INTAKE_TRIAGE_ID, getSpecialistVersion } from "../lib/evals/specialists"
import { SEEDED_THERAPY_NAMES } from "../lib/evals/catalogue"
import { computeVerdict } from "../lib/evals/verdict"

/**
 * Characterisation: the generic grading engine must give exactly the verdicts the original,
 * severity-and-therapy engine gave, for the shipped specialist versions, in every environment
 * this app has seen: the full therapy catalogue, each therapy removed in turn, and none at all.
 * If this ever disagrees, the generic engine has changed behaviour.
 */

const environments: [string, string[]][] = [
  ["the full catalogue", SEEDED_THERAPY_NAMES],
  ...SEEDED_THERAPY_NAMES.map((missing): [string, string[]] => [
    `the catalogue without "${missing}"`,
    SEEDED_THERAPY_NAMES.filter((n) => n !== missing),
  ]),
  ["an empty catalogue", []],
]

const versions = ["v1", "v2"]

async function generic(version: string, catalogue: string[]) {
  const specialist = getSpecialistVersion(INTAKE_TRIAGE_ID, version)!
  const outputs: Record<string, OutputValues> = {}
  for (const s of INTAKE_TRIAGE_SCENARIOS) {
    outputs[s.id] = { ...specialist.run({ description: s.description, therapies: catalogue }) }
  }
  return gradeOutputs({ spec: intakeTriageSpec, outputs, lists: { therapies: catalogue } })
}

function original(version: string, catalogue: string[]) {
  const specialist = getSpecialistVersion(INTAKE_TRIAGE_ID, version)!
  return INTAKE_TRIAGE_SCENARIOS.map((s) => {
    const out = specialist.run({ description: s.description, therapies: catalogue })
    return { id: s.id, split: s.split, passed: runChecks(s, out, catalogue).passed }
  })
}

describe("the generic engine agrees with the original", () => {
  describe.each(versions)("specialist %s", (version) => {
    it.each(environments)("scenario by scenario in %s", async (_name, catalogue) => {
      const before = original(version, catalogue)
      const after = await generic(version, catalogue)
      expect(after.rows.map((r) => ({ id: r.scenarioId, passed: r.passed }))).toEqual(
        before.map((b) => ({ id: b.id, passed: b.passed }))
      )
    })

    it.each(environments)("in counts and verdict in %s", async (_name, catalogue) => {
      const before = original(version, catalogue)
      const after = await generic(version, catalogue)
      const count = (split: string) => before.filter((b) => b.split === split)
      expect(after.devTotal).toBe(count("DEV").length)
      expect(after.devPassed).toBe(count("DEV").filter((b) => b.passed).length)
      expect(after.holdoutTotal).toBe(count("HOLDOUT").length)
      expect(after.holdoutPassed).toBe(count("HOLDOUT").filter((b) => b.passed).length)
      expect(computeVerdict(after).verdict).toBe(
        computeVerdict({
          devTotal: count("DEV").length,
          devPassed: count("DEV").filter((b) => b.passed).length,
          holdoutTotal: count("HOLDOUT").length,
          holdoutPassed: count("HOLDOUT").filter((b) => b.passed).length,
        }).verdict
      )
    })
  })

  it("keeps the pinned totals: v1 12 of 24 dev and 3 of 8 hold-out, FAIL", async () => {
    const run = await generic("v1", SEEDED_THERAPY_NAMES)
    expect([run.devPassed, run.devTotal, run.holdoutPassed, run.holdoutTotal]).toEqual([12, 24, 3, 8])
    expect(computeVerdict(run).verdict).toBe("FAIL")
  })

  it("keeps the pinned totals: v2 22 of 24 dev and 7 of 8 hold-out, PASS, failing exactly d23, d24, h08", async () => {
    const run = await generic("v2", SEEDED_THERAPY_NAMES)
    expect([run.devPassed, run.devTotal, run.holdoutPassed, run.holdoutTotal]).toEqual([22, 24, 7, 8])
    expect(computeVerdict(run).verdict).toBe("PASS")
    expect(run.rows.filter((r) => !r.passed).map((r) => r.scenarioId)).toEqual(["d23", "d24", "h08"])
  })

  it("reproduces the original categories in the new generic form", async () => {
    // v1 on the full catalogue: a severity-only, therapy-only and both-wrong scenario exist.
    const run = await generic("v1", SEEDED_THERAPY_NAMES)
    const category = (id: string) => run.rows.find((r) => r.scenarioId === id)!.category
    expect(category("d06")).toBe("MISMATCH:severity") // was SEVERITY
    expect(category("d05")).toBe("MISMATCH:therapy") // was THERAPY
    expect(category("d23")).toBe("MISMATCH:severity+MISMATCH:therapy") // was SEVERITY_AND_THERAPY
  })

  it("reports a therapy missing from the catalogue as not in the reference list", async () => {
    const without = SEEDED_THERAPY_NAMES.filter((n) => n !== "Token Budget Anxiety Relief")
    const run = await generic("v2", without)
    const d01 = run.rows.find((r) => r.scenarioId === "d01")!
    expect(d01.passed).toBe(false)
    expect(d01.category).toBe("NOT_IN_REFERENCE:therapy") // was THERAPY_NOT_IN_CATALOGUE
    expect(d01.reason).toContain('"Token Budget Anxiety Relief"')
  })

  it("the derived spec has the same 32 scenarios and 10 themes as the original data", () => {
    expect(intakeTriageSpec.scenarios).toHaveLength(32)
    expect(intakeTriageSpec.themes).toHaveLength(10)
    expect(intakeTriageSpec.scenarios.filter((s) => s.split === "DEV")).toHaveLength(24)
  })

  it("maps expected severity to weights 1, 2 and 3 so triage scores do not change", () => {
    const weight = (id: string) => intakeTriageSpec.scenarios.find((s) => s.id === id)!.weight
    expect(weight("d09")).toBe(1) // LOW
    expect(weight("d02")).toBe(2) // MEDIUM
    expect(weight("d01")).toBe(3) // HIGH
  })
})
