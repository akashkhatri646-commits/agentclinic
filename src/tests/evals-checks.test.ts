import { describe, it, expect } from "vitest"
import { runChecks } from "../lib/evals/checks"
import { SEEDED_THERAPY_NAMES, THERAPY } from "../lib/evals/catalogue"
import type { Scenario, SpecialistOutput } from "../lib/evals/types"

const scenario: Scenario = {
  id: "t1",
  split: "DEV",
  description: "anything",
  expectedSeverity: "HIGH",
  expectedTherapy: THERAPY.TOKEN_BUDGET_RELIEF,
  why: "test",
}

const good: SpecialistOutput = {
  severity: "HIGH",
  therapy: THERAPY.TOKEN_BUDGET_RELIEF,
  rationale: "Because.",
}

describe("runChecks", () => {
  it("passes when everything matches", () => {
    expect(runChecks(scenario, good, SEEDED_THERAPY_NAMES)).toEqual({
      passed: true,
      category: null,
      reason: null,
    })
  })

  it("fails on severity alone and names expected versus actual", () => {
    const r = runChecks(scenario, { ...good, severity: "LOW" }, SEEDED_THERAPY_NAMES)
    expect(r.passed).toBe(false)
    expect(r.category).toBe("SEVERITY")
    expect(r.reason).toBe("Severity was LOW, expected HIGH.")
  })

  it("fails on therapy alone and names expected versus actual", () => {
    const r = runChecks(
      scenario,
      { ...good, therapy: THERAPY.PROMPT_DETOX },
      SEEDED_THERAPY_NAMES
    )
    expect(r.category).toBe("THERAPY")
    expect(r.reason).toBe('Therapy was "Prompt Detox", expected "Token Budget Anxiety Relief".')
  })

  it("reports both when severity and therapy are wrong", () => {
    const r = runChecks(
      scenario,
      { ...good, severity: "LOW", therapy: THERAPY.PROMPT_DETOX },
      SEEDED_THERAPY_NAMES
    )
    expect(r.category).toBe("SEVERITY_AND_THERAPY")
    expect(r.reason).toContain("Severity was LOW, expected HIGH")
    expect(r.reason).toContain('therapy was "Prompt Detox"')
  })

  it("fails when the recommended therapy is not in the live catalogue, even if it matches the expected one", () => {
    const withoutTokenTherapy = SEEDED_THERAPY_NAMES.filter(
      (n) => n !== THERAPY.TOKEN_BUDGET_RELIEF
    )
    const r = runChecks(scenario, good, withoutTokenTherapy)
    expect(r.passed).toBe(false)
    expect(r.category).toBe("THERAPY_NOT_IN_CATALOGUE")
    expect(r.reason).toContain("is not in the clinic catalogue")
  })

  it("mentions a severity mismatch too when the therapy is missing from the catalogue", () => {
    const r = runChecks(scenario, { ...good, severity: "LOW" }, [])
    expect(r.category).toBe("THERAPY_NOT_IN_CATALOGUE")
    expect(r.reason).toContain("also severity was LOW, expected HIGH")
  })

  it("fails an empty or whitespace-only rationale", () => {
    for (const rationale of ["", "   "]) {
      const r = runChecks(scenario, { ...good, rationale }, SEEDED_THERAPY_NAMES)
      expect(r.category).toBe("RATIONALE")
      expect(r.reason).toBe("Rationale is empty.")
    }
  })

  it("handles an empty catalogue without throwing", () => {
    expect(() => runChecks(scenario, good, [])).not.toThrow()
  })
})
