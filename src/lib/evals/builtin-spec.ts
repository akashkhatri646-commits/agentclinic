import { INTAKE_TRIAGE_SCENARIOS } from "./scenarios/intake-triage"
import type { SpecialistSpec } from "./spec"
import { THEMES } from "./themes"
import { SEVERITY_WEIGHT } from "./triage"

/**
 * The built-in intake-triage specialist expressed in the generic format, derived from the
 * scenario data written in Phase 7. Used to prove the generic grading engine gives the same
 * results as the original; the database seed will carry the same definition as a template.
 */
export const intakeTriageSpec: SpecialistSpec = {
  slug: "intake-triage",
  name: "Intake triage",
  description: "Reads an ailment description and recommends a severity and a therapy.",
  outputFields: [
    { name: "severity", description: "LOW, MEDIUM or HIGH." },
    { name: "therapy", description: "The name of a therapy in the clinic catalogue." },
    { name: "rationale", description: "A short explanation of the choice." },
  ],
  checks: [
    { field: "severity", type: "equals" },
    { field: "therapy", type: "equals" },
    { field: "therapy", type: "inReference", list: "therapies" },
    { field: "rationale", type: "nonEmpty" },
  ],
  themes: THEMES.map((t) => ({ id: t.id, label: t.label, description: t.description })),
  judge: { field: "rationale" },
  scenarios: INTAKE_TRIAGE_SCENARIOS.map((s) => ({
    id: s.id,
    split: s.split,
    theme: s.theme,
    weight: SEVERITY_WEIGHT[s.expectedSeverity],
    input: s.description,
    expected: { severity: s.expectedSeverity, therapy: s.expectedTherapy },
    why: s.why,
  })),
}
