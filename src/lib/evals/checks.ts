import type { FailureCategory, Scenario, SpecialistOutput } from "./types"

export type CheckResult = {
  passed: boolean
  category: FailureCategory | null
  reason: string | null
}

const PASS: CheckResult = { passed: true, category: null, reason: null }

/**
 * Deterministic checks for one scenario: severity matches, therapy matches,
 * the recommended therapy exists in the live catalogue, and the rationale is
 * not empty. A failure always carries a category and a readable reason.
 */
export function runChecks(
  scenario: Scenario,
  output: SpecialistOutput,
  catalogue: string[]
): CheckResult {
  const severityOk = output.severity === scenario.expectedSeverity
  const therapyOk = output.therapy === scenario.expectedTherapy
  const inCatalogue = catalogue.includes(output.therapy)

  const severityNote = severityOk
    ? null
    : `severity was ${output.severity}, expected ${scenario.expectedSeverity}`
  const therapyNote = therapyOk
    ? null
    : `therapy was "${output.therapy}", expected "${scenario.expectedTherapy}"`

  if (!inCatalogue) {
    const extras = [severityNote].filter(Boolean)
    return {
      passed: false,
      category: "THERAPY_NOT_IN_CATALOGUE",
      reason:
        `Recommended therapy "${output.therapy}" is not in the clinic catalogue` +
        (extras.length ? `; also ${extras.join("; ")}` : "") +
        ".",
    }
  }

  if (!severityOk && !therapyOk) {
    return {
      passed: false,
      category: "SEVERITY_AND_THERAPY",
      reason: `${capitalise(severityNote!)}; ${therapyNote}.`,
    }
  }
  if (!severityOk) {
    return { passed: false, category: "SEVERITY", reason: `${capitalise(severityNote!)}.` }
  }
  if (!therapyOk) {
    return { passed: false, category: "THERAPY", reason: `${capitalise(therapyNote!)}.` }
  }

  if (output.rationale.trim() === "") {
    return { passed: false, category: "RATIONALE", reason: "Rationale is empty." }
  }

  return PASS
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
