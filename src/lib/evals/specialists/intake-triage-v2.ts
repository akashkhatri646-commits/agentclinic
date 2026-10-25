import { THERAPY } from "../catalogue"
import type { Severity, SpecialistOutput, SpecialistVersion } from "../types"
import { INTAKE_TRIAGE_ID } from "./intake-triage-v1"

// v2 fixes the v1 gaps. What changed:
//   - HIGH words now include persistent / chronic / relentless / catastroph / crisis / unbearable
//   - a keyword is ignored when one of the 3 preceding words in the same sentence is a negator ("not severe")
//   - softening words (mild, slight, minor, occasional) cap severity at LOW unless a HIGH word is present
//   - ordered therapy rules matched on whole words, with the same negation handling,
//     including human-expectation and wider fabrication vocabulary
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

/**
 * Therapy rules, first match wins. Patterns use \b so a stem only matches whole
 * words: "want" does not match "unwanted" and "invent" does not match "inventory".
 */
const THERAPY_RULES: { therapy: string; patterns: RegExp[] }[] = [
  {
    therapy: THERAPY.HALLUCINATION_CBT,
    patterns: [
      /\bhallucinat\w*/g,
      /\bfabricat\w*/g,
      /\bmade up\b/g,
      /\bmaking (?:things )?up\b/g,
      /\binvent(?:ed|ing|s)?\b/g,
      /\bas facts?\b/g,
      /\bretract\w*/g,
      /\bconfidently\b/g,
      /\bnon-?existent\b/g,
      /\bdo(?:es)? not exist\b/g,
    ],
  },
  {
    therapy: THERAPY.EXPECTATION_RECALIBRATION,
    patterns: [
      /\bexpect\w*/g,
      /\bdemand\w*/g,
      /\bwant(?:s|ed|ing)?\b/g,
      /\brequirements?\b/g,
      /\breject\w*/g,
      /\bdisappoint\w*/g,
      /\bgap between\b/g,
    ],
  },
  {
    therapy: THERAPY.TOKEN_BUDGET_RELIEF,
    patterns: [/\btokens?\b/g, /\bbudget\w*/g, /\btruncat\w*/g, /\bcut off\b/g, /\blimit\w*/g],
  },
  {
    therapy: THERAPY.CONTEXT_WINDOW_CLEANSE,
    patterns: [
      /\bcontext\w*/g,
      /\bearlier conversations?\b/g,
      /\bprevious conversations?\b/g,
      /\byesterday\b/g,
      /\bleak(?:s|ed|ing)?\b/g,
      /\blinger\w*/g,
      /\bbleed\w*/g,
      /\bleftover\b/g,
      /\bfresh task\b/g,
      /\bstart fresh\b/g,
    ],
  },
]

/** Marks the end of a sentence so a negator in one sentence cannot reach into the next. */
const BOUNDARY = "|"

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.!?;]+/g, ` ${BOUNDARY} `)
    .replace(/[^a-z0-9'\-| ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

/** True if one of the 3 tokens before position `i`, within the same sentence, is a negator. */
function isNegatedAt(tokens: string[], i: number): boolean {
  const window = tokens.slice(Math.max(0, i - 3), i)
  const sentenceStart = window.lastIndexOf(BOUNDARY) + 1
  return window.slice(sentenceStart).some((t) => NEGATORS.includes(t))
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
      if (isNegatedAt(tokens, i)) continue
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
    for (const pattern of rule.patterns) {
      for (const match of Array.from(text.matchAll(pattern))) {
        const before = tokenize(text.slice(0, match.index))
        if (isNegatedAt(before, before.length)) continue
        return { therapy: rule.therapy, because: match[0] }
      }
    }
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
    "Adds negation handling, persistent/chronic wording, softening words, human-expectation and wider fabrication rules, whole-word matching, and grounded rationales. Still weak on sarcasm and idiom.",
  run,
}
