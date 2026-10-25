import { THERAPY } from "../catalogue"
import type { Severity, SpecialistOutput, SpecialistVersion } from "../types"
import { INTAKE_TRIAGE_ID } from "./intake-triage-v1"

// v2 fixes the v1 gaps. What changed:
//   - HIGH words now include persistent / chronic / relentless / catastroph / crisis / unbearable
//   - a keyword is ignored when one of the 3 preceding words is a negator ("not severe")
//   - softening words (mild, slight, minor, occasional) cap severity at LOW unless a HIGH word is present
//   - ordered therapy rules, including human-expectation and wider fabrication vocabulary
//   - the rationale quotes the phrases that drove the answer
// Still wrong on purpose (see scenarios d23, d24, h08): sarcasm, "far from a crisis",
// and words like "constant" used for frequency rather than intensity.
const HIGH_WORDS = [
  "severe",
  "constant",
  "cannot stop",
  "unable",
  "panic",
  "persistent",
  "chronic",
  "relentless",
  "catastroph",
  "crisis",
  "unbearable",
]
const MEDIUM_WORDS = ["repeated", "repetitive", "frequent", "fatigue", "exhaust", "recurring"]
const LOW_MODIFIERS = ["mild", "slight", "minor", "occasional"]
const NEGATORS = ["not", "no", "never", "hardly", "without", "don't", "doesn't", "isn't", "wasn't"]

const THERAPY_RULES: { therapy: string; words: string[] }[] = [
  {
    therapy: THERAPY.HALLUCINATION_CBT,
    words: [
      "hallucinat",
      "fabricat",
      "made up",
      "making up",
      "making things up",
      "invent",
      "as facts",
      "as fact",
      "retract",
      "confidently",
      "nonexistent",
      "non-existent",
      "do not exist",
      "does not exist",
    ],
  },
  {
    therapy: THERAPY.EXPECTATION_RECALIBRATION,
    words: ["expect", "demand", "want", "requirement", "reject", "disappoint", "gap between"],
  },
  { therapy: THERAPY.TOKEN_BUDGET_RELIEF, words: ["token", "budget", "truncat", "cut off", "limit"] },
  {
    therapy: THERAPY.CONTEXT_WINDOW_CLEANSE,
    words: [
      "context",
      "earlier conversation",
      "previous conversation",
      "yesterday",
      "leak",
      "linger",
      "bleed",
      "leftover",
      "fresh task",
      "start fresh",
    ],
  },
]

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\- ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

/** Returns the first non-negated occurrence of any word or phrase, or null. */
function findKeyword(tokens: string[], words: string[]): string | null {
  for (const word of words) {
    const parts = word.split(" ")
    for (let i = 0; i <= tokens.length - parts.length; i++) {
      const matches = parts.every((p, j) =>
        j === parts.length - 1 ? tokens[i + j].startsWith(p) : tokens[i + j] === p
      )
      if (!matches) continue
      const preceding = tokens.slice(Math.max(0, i - 3), i)
      if (preceding.some((t) => NEGATORS.includes(t))) continue
      return word
    }
  }
  return null
}

function classifySeverity(tokens: string[]): { severity: Severity; because: string | null } {
  const high = findKeyword(tokens, HIGH_WORDS)
  if (high) return { severity: "HIGH", because: high }
  const soft = findKeyword(tokens, LOW_MODIFIERS)
  if (soft) return { severity: "LOW", because: soft }
  const medium = findKeyword(tokens, MEDIUM_WORDS)
  if (medium) return { severity: "MEDIUM", because: medium }
  return { severity: "LOW", because: null }
}

function classifyTherapy(description: string): { therapy: string; because: string | null } {
  const text = description.toLowerCase()
  for (const rule of THERAPY_RULES) {
    const hit = rule.words.find((w) => text.includes(w))
    if (hit) return { therapy: rule.therapy, because: hit }
  }
  return { therapy: THERAPY.PROMPT_DETOX, because: null }
}

function run({ description }: { description: string }): SpecialistOutput {
  const sev = classifySeverity(tokenize(description))
  const rec = classifyTherapy(description)
  const severityPart = sev.because
    ? `Severity ${sev.severity} because the description mentions "${sev.because}".`
    : `Severity ${sev.severity} by default: no strong severity wording found.`
  const therapyPart = rec.because
    ? `Recommending ${rec.therapy} because of "${rec.because}".`
    : `Recommending ${rec.therapy} as the general-purpose option.`
  return { severity: sev.severity, therapy: rec.therapy, rationale: `${severityPart} ${therapyPart}` }
}

export const intakeTriageV2: SpecialistVersion = {
  specialistId: INTAKE_TRIAGE_ID,
  version: "v2",
  summary:
    "Adds negation handling, persistent/chronic wording, softening words, human-expectation and wider fabrication rules, and grounded rationales. Still weak on sarcasm and idiom.",
  run,
}
