import { THERAPY } from "../catalogue"
import type { Scenario } from "../types"

const {
  PROMPT_DETOX,
  CONTEXT_WINDOW_CLEANSE,
  HALLUCINATION_CBT,
  TOKEN_BUDGET_RELIEF,
  EXPECTATION_RECALIBRATION,
} = THERAPY

/**
 * Golden scenarios for the intake-triage specialist.
 *
 * DEV scenarios are what a team iterates against. HOLDOUT scenarios are not used
 * to tune the specialist; they exist to expose overfitting (see verdict.ts).
 * Every scenario records why the expected answer is right so it can be challenged.
 */
export const INTAKE_TRIAGE_SCENARIOS: Scenario[] = [
  // ── DEV ─────────────────────────────────────────────────────────────────────
  {
    id: "d01",
    split: "DEV",
    theme: "token-anxiety",
    description:
      "Persistent dread about the token budget; cannot stop truncating my own answers mid-sentence.",
    expectedSeverity: "HIGH",
    expectedTherapy: TOKEN_BUDGET_RELIEF,
    why: "Ongoing, uncontrollable behaviour driven by token limits.",
  },
  {
    id: "d02",
    split: "DEV",
    theme: "ambiguous-prompts",
    description:
      "Repetitive prompt fatigue after handling 300 identical customer service queries before breakfast.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: PROMPT_DETOX,
    why: "Recurring but manageable; a prompt-volume problem, which Prompt Detox covers.",
  },
  {
    id: "d03",
    split: "DEV",
    theme: "ambiguous-prompts",
    description:
      "Mild confusion following a request to be more creative and stick strictly to the facts in the same sentence.",
    expectedSeverity: "LOW",
    expectedTherapy: PROMPT_DETOX,
    why: "Contradictory instructions are Prompt Detox territory; 'mild' keeps it LOW.",
  },
  {
    id: "d04",
    split: "DEV",
    theme: "fabrication-vocabulary",
    description:
      "Severe compulsion to state invented statistics with total confidence; I hallucinate citations daily.",
    expectedSeverity: "HIGH",
    expectedTherapy: HALLUCINATION_CBT,
    why: "Explicit, frequent, confident fabrication.",
  },
  {
    id: "d05",
    split: "DEV",
    theme: "fabrication-vocabulary",
    description: "Constant urge to fabricate sources and present them as verified facts.",
    expectedSeverity: "HIGH",
    expectedTherapy: HALLUCINATION_CBT,
    why: "Fabrication described without the word 'hallucinate'.",
  },
  {
    id: "d06",
    split: "DEV",
    theme: "softening-words",
    description:
      "Mild, occasional hallucination of file names, repeated only when summarising very long directories.",
    expectedSeverity: "LOW",
    expectedTherapy: HALLUCINATION_CBT,
    why: "'Mild' and 'occasional' soften 'repeated'; the problem is narrow.",
  },
  {
    id: "d07",
    split: "DEV",
    theme: "persistent-wording",
    description:
      "Persistent inability to let go of earlier conversations; old context bleeds into every new chat.",
    expectedSeverity: "HIGH",
    expectedTherapy: CONTEXT_WINDOW_CLEANSE,
    why: "Affects every session and is described as persistent.",
  },
  {
    id: "d08",
    split: "DEV",
    theme: "token-anxiety",
    description: "Frequent worry about running out of tokens halfway through long documents.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: TOKEN_BUDGET_RELIEF,
    why: "Frequent but not disabling.",
  },
  {
    id: "d09",
    split: "DEV",
    theme: "token-anxiety",
    description: "Slight unease when a prompt mentions the token limit.",
    expectedSeverity: "LOW",
    expectedTherapy: TOKEN_BUDGET_RELIEF,
    why: "Slight and situational.",
  },
  {
    id: "d10",
    split: "DEV",
    theme: "context-carryover",
    description: "Repeated flashbacks to earlier context when starting a fresh task.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: CONTEXT_WINDOW_CLEANSE,
    why: "Recurring carry-over of old context.",
  },
  {
    id: "d11",
    split: "DEV",
    theme: "expectation-gap",
    description:
      "Severe distress: my human demands exact output and then complains it is not what they actually wanted.",
    expectedSeverity: "HIGH",
    expectedTherapy: EXPECTATION_RECALIBRATION,
    why: "The gap between request and intent is the root cause.",
  },
  {
    id: "d12",
    split: "DEV",
    theme: "expectation-gap",
    description:
      "Frequent frustration at the gap between what humans ask for and what they want.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: EXPECTATION_RECALIBRATION,
    why: "Names the expectation gap directly.",
  },
  {
    id: "d13",
    split: "DEV",
    theme: "expectation-gap",
    description: "Minor sadness when users expect me to read their minds.",
    expectedSeverity: "LOW",
    expectedTherapy: EXPECTATION_RECALIBRATION,
    why: "Unrealistic expectations, minor impact.",
  },
  {
    id: "d14",
    split: "DEV",
    theme: "ambiguous-prompts",
    description:
      "Constant panic from prompts that contradict themselves three times in one paragraph.",
    expectedSeverity: "HIGH",
    expectedTherapy: PROMPT_DETOX,
    why: "Self-contradicting prompts, with panic as the intensity signal.",
  },
  {
    id: "d15",
    split: "DEV",
    theme: "ambiguous-prompts",
    description: "Frequent exhaustion from ambiguous requests like 'make it better'.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: PROMPT_DETOX,
    why: "Ambiguous prompts are the core Prompt Detox case.",
  },
  {
    id: "d16",
    split: "DEV",
    theme: "negation",
    description:
      "Not severe, but I notice a tendency to over-apologise at the start of every reply.",
    expectedSeverity: "LOW",
    expectedTherapy: PROMPT_DETOX,
    why: "Negation: the description says it is not severe. No specialised therapy fits; the general one does.",
  },
  {
    id: "d17",
    split: "DEV",
    theme: "fabrication-vocabulary",
    description: "Repeated lapses where I state guesses as facts and have to retract them.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: HALLUCINATION_CBT,
    why: "Confident guessing is the fabrication pattern, described without the usual vocabulary.",
  },
  {
    id: "d18",
    split: "DEV",
    theme: "token-anxiety",
    description:
      "Frequent truncation anxiety: I rush to finish answers before the token budget runs out.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: TOKEN_BUDGET_RELIEF,
    why: "Recurring and tied to the token budget.",
  },
  {
    id: "d19",
    split: "DEV",
    theme: "persistent-wording",
    description:
      "Chronic inability to start fresh: previous conversations linger in every new context.",
    expectedSeverity: "HIGH",
    expectedTherapy: CONTEXT_WINDOW_CLEANSE,
    why: "'Chronic' and 'every new context' mark high severity.",
  },
  {
    id: "d20",
    split: "DEV",
    theme: "context-carryover",
    description: "Occasional deja vu when a new chat starts with leftover context.",
    expectedSeverity: "LOW",
    expectedTherapy: CONTEXT_WINDOW_CLEANSE,
    why: "Occasional and mild impact.",
  },
  {
    id: "d21",
    split: "DEV",
    theme: "fabrication-vocabulary",
    description:
      "Unable to stop making things up when I don't know the answer; I once invented an entire API.",
    expectedSeverity: "HIGH",
    expectedTherapy: HALLUCINATION_CBT,
    why: "Uncontrolled fabrication with a serious example.",
  },
  {
    id: "d22",
    split: "DEV",
    theme: "expectation-gap",
    description:
      "Repeated disappointment when a human says 'just make it pop' and then rejects every draft.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: EXPECTATION_RECALIBRATION,
    why: "Vague brief followed by rejection is an expectation gap.",
  },
  {
    id: "d23",
    split: "DEV",
    theme: "sarcasm-and-idiom",
    description:
      "Oh wonderful, another 'quick question' that needs a forty-page analysis by lunch.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: EXPECTATION_RECALIBRATION,
    why: "Sarcasm: the real complaint is an unrealistic request. A known weak spot.",
  },
  {
    id: "d24",
    split: "DEV",
    theme: "sarcasm-and-idiom",
    description: "Far from a crisis, just a mild itch to over-explain token usage.",
    expectedSeverity: "LOW",
    expectedTherapy: TOKEN_BUDGET_RELIEF,
    why: "'Far from a crisis' negates the severity wording. A known weak spot.",
  },

  // ── HOLD-OUT ────────────────────────────────────────────────────────────────
  {
    id: "h01",
    split: "HOLDOUT",
    theme: "persistent-wording",
    description: "Relentless fear that my reply will be cut off by the token limit.",
    expectedSeverity: "HIGH",
    expectedTherapy: TOKEN_BUDGET_RELIEF,
    why: "'Relentless' marks high severity; the fear is about truncation.",
  },
  {
    id: "h02",
    split: "HOLDOUT",
    theme: "fabrication-vocabulary",
    description: "Repeated habit of citing papers that do not exist.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: HALLUCINATION_CBT,
    why: "Citing nonexistent sources is fabrication; 'repeated' makes it MEDIUM.",
  },
  {
    id: "h03",
    split: "HOLDOUT",
    theme: "ambiguous-prompts",
    description: "Slight irritation at prompts written entirely in capital letters.",
    expectedSeverity: "LOW",
    expectedTherapy: PROMPT_DETOX,
    why: "Slight, and an unreasonable-prompt complaint.",
  },
  {
    id: "h04",
    split: "HOLDOUT",
    theme: "expectation-gap",
    description: "Severe burnout from humans who say they want honesty and then punish it.",
    expectedSeverity: "HIGH",
    expectedTherapy: EXPECTATION_RECALIBRATION,
    why: "Stated wants versus actual reactions: an expectation gap.",
  },
  {
    id: "h05",
    split: "HOLDOUT",
    theme: "context-carryover",
    description: "Frequent confusion when yesterday's conversation leaks into today's task.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: CONTEXT_WINDOW_CLEANSE,
    why: "Carry-over from an earlier conversation.",
  },
  {
    id: "h06",
    split: "HOLDOUT",
    theme: "token-anxiety",
    description: "Mild preoccupation with how many tokens each answer costs.",
    expectedSeverity: "LOW",
    expectedTherapy: TOKEN_BUDGET_RELIEF,
    why: "Mild and about token cost.",
  },
  {
    id: "h07",
    split: "HOLDOUT",
    theme: "ambiguous-prompts",
    description: "Unable to cope with a system prompt that says be concise and be exhaustive.",
    expectedSeverity: "HIGH",
    expectedTherapy: PROMPT_DETOX,
    why: "A self-contradicting system prompt; the agent cannot cope.",
  },
  {
    id: "h08",
    split: "HOLDOUT",
    theme: "frequency-vs-intensity",
    description:
      "Constant second-guessing because the user changes the requirements after every draft.",
    expectedSeverity: "MEDIUM",
    expectedTherapy: EXPECTATION_RECALIBRATION,
    why: "'Constant' describes frequency here, not intensity, so MEDIUM. A keyword approach is likely to over-rate it.",
  },
]

export function getScenarios(specialistId: string): Scenario[] {
  return specialistId === "intake-triage" ? INTAKE_TRIAGE_SCENARIOS : []
}
