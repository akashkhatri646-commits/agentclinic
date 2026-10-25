export type Severity = "LOW" | "MEDIUM" | "HIGH"
export type Split = "DEV" | "HOLDOUT"
export type Verdict = "PASS" | "FAIL"

export type FailureCategory =
  | "SEVERITY"
  | "THERAPY"
  | "SEVERITY_AND_THERAPY"
  | "THERAPY_NOT_IN_CATALOGUE"
  | "RATIONALE"

export type SpecialistInput = {
  description: string
  /** Names of the therapies currently in the clinic catalogue. */
  therapies: string[]
}

export type SpecialistOutput = {
  severity: Severity
  therapy: string
  rationale: string
}

export type Scenario = {
  id: string
  split: Split
  description: string
  expectedSeverity: Severity
  expectedTherapy: string
  /** One line explaining the expected answer, so a reviewer can challenge it. */
  why: string
}

export type SpecialistVersion = {
  specialistId: string
  version: string
  /** What this version changed or is known to get wrong. */
  summary: string
  run: (input: SpecialistInput) => SpecialistOutput
}

/** `score` is null when the judge could not produce a usable score; `note` says why. */
export type JudgeResult = { score: number | null; note: string }

export type Judge = {
  score(description: string, rationale: string): Promise<JudgeResult>
}
