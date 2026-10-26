import { describe, it, expect } from "vitest"
import { gradeOutputs, type OutputValues } from "../lib/evals/grade"
import { intakeTriageSpec } from "../lib/evals/builtin-spec"
import { INTAKE_TRIAGE_SCENARIOS } from "../lib/evals/scenarios/intake-triage"
import { INTAKE_TRIAGE_ID, getSpecialistVersion } from "../lib/evals/specialists"
import { SEEDED_THERAPY_NAMES } from "../lib/evals/catalogue"
import { computeVerdict } from "../lib/evals/verdict"

/**
 * Characterisation. Until Phase 10 the severity-and-therapy checks were hard-coded; the generic
 * engine replaced them after a scenario-by-scenario comparison showed identical results for v1
 * and v2 in every catalogue (full, each therapy removed, empty). That comparison is gone with
 * the old engine; what remains pins the results it protected, so any change to the generic
 * engine, the scenarios or the specialists that moves them fails here.
 */

const environments: [string, string[]][] = [
  ["the full catalogue", SEEDED_THERAPY_NAMES],
  ...SEEDED_THERAPY_NAMES.map((missing): [string, string[]] => [
    `the catalogue without "${missing}"`,
    SEEDED_THERAPY_NAMES.filter((n) => n !== missing),
  ]),
  ["an empty catalogue", []],
]

async function generic(version: string, catalogue: string[]) {
  const specialist = getSpecialistVersion(INTAKE_TRIAGE_ID, version)!
  const outputs: Record<string, OutputValues> = {}
  for (const s of INTAKE_TRIAGE_SCENARIOS) {
    outputs[s.id] = { ...specialist.run({ description: s.description, therapies: catalogue }) }
  }
  return gradeOutputs({ spec: intakeTriageSpec, outputs, lists: { therapies: catalogue } })
}

describe("the generic engine keeps the pinned results", () => {
  it.each(environments)("never passes more scenarios than the full catalogue does, in %s", async (_name, catalogue) => {
    for (const version of ["v1", "v2"]) {
      const full = await generic(version, SEEDED_THERAPY_NAMES)
      const run = await generic(version, catalogue)
      expect(run.devPassed + run.holdoutPassed).toBeLessThanOrEqual(full.devPassed + full.holdoutPassed)
    }
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
