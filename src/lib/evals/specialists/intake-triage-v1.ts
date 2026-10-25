import { THERAPY } from "../catalogue"
import type { Severity, SpecialistOutput, SpecialistVersion } from "../types"

export const INTAKE_TRIAGE_ID = "intake-triage"

// v1 is the baseline. It is a plain keyword scan with known gaps, kept as-is
// so v2 has something real to improve on:
//   - ignores negation ("not severe" is still HIGH)
//   - has no words for persistent / chronic / relentless distress
//   - ignores softening words ("mild", "occasional") when a MEDIUM word is present
//   - has no rule for human-expectation problems, so they fall through to Prompt Detox
//   - only knows "hallucinat" for fabrication problems
const HIGH_WORDS = ["severe", "constant", "cannot stop", "unable", "panic"]
const MEDIUM_WORDS = ["repeated", "repetitive", "frequent", "fatigue"]

function severity(text: string): Severity {
  if (HIGH_WORDS.some((w) => text.includes(w))) return "HIGH"
  if (MEDIUM_WORDS.some((w) => text.includes(w))) return "MEDIUM"
  return "LOW"
}

function therapy(text: string): string {
  if (text.includes("hallucinat")) return THERAPY.HALLUCINATION_CBT
  if (text.includes("token") || text.includes("budget")) return THERAPY.TOKEN_BUDGET_RELIEF
  if (text.includes("context")) return THERAPY.CONTEXT_WINDOW_CLEANSE
  return THERAPY.PROMPT_DETOX
}

function run({ description }: { description: string }): SpecialistOutput {
  const text = description.toLowerCase()
  return {
    severity: severity(text),
    therapy: therapy(text),
    rationale: "Classified by keyword rules (v1).",
  }
}

export const intakeTriageV1: SpecialistVersion = {
  specialistId: INTAKE_TRIAGE_ID,
  version: "v1",
  // Approximate: v1 and v2 were both written on 2026-10-25, the day Phase 7 was built.
  releasedAt: new Date("2026-10-25T09:00:00Z"),
  summary: "Baseline keyword rules. Known gaps: negation, persistent/chronic wording, softening words, human-expectation therapy, fabrication synonyms.",
  run,
}
