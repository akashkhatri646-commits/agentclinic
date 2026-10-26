import type { ThemeId } from "./themes"

export type Severity = "LOW" | "MEDIUM" | "HIGH"
export type Split = "DEV" | "HOLDOUT"
export type Verdict = "PASS" | "FAIL"

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
  /** The weakness this scenario probes. Failing scenarios are grouped by theme into failure modes. */
  theme: ThemeId
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
  /** When this version shipped. Copied onto each run as the start of the loop-time measurement. */
  releasedAt: Date
  run: (input: SpecialistInput) => SpecialistOutput
}

/** `score` is null when the judge could not produce a usable score; `note` says why. */
export type JudgeResult = { score: number | null; note: string }

/** What is being judged: the output field's name and the description its owner gave it. */
export type JudgeContext = { field: string; description: string }

export type Judge = {
  /**
   * Scores one output of a specialist for one input. `context` names the field being judged and
   * says what it is, because the judge serves any specialist, not only the clinic's.
   */
  score(input: string, output: string, context?: JudgeContext): Promise<JudgeResult>
}
