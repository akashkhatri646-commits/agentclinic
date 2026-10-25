/**
 * A theme names the weakness a golden scenario probes. Failing scenarios are
 * grouped by theme into failure modes, so each failure mode names something a
 * fix can target ("handle negation") instead of a symptom ("therapy mismatch").
 *
 * The assignment of scenarios to themes is authored judgement and lives with
 * the scenarios in scenarios/intake-triage.ts, where it can be reviewed.
 */
export type ThemeId =
  | "token-anxiety"
  | "ambiguous-prompts"
  | "fabrication-vocabulary"
  | "expectation-gap"
  | "context-carryover"
  | "persistent-wording"
  | "negation"
  | "softening-words"
  | "sarcasm-and-idiom"
  | "frequency-vs-intensity"

export type Theme = { id: ThemeId; label: string; description: string }

export const THEMES: Theme[] = [
  {
    id: "token-anxiety",
    label: "Token and budget worries",
    description: "Distress about token limits, truncation and budgets.",
  },
  {
    id: "ambiguous-prompts",
    label: "Ambiguous or contradictory prompts",
    description: "Vague, contradictory or unreasonable instructions, and the fatigue they cause.",
  },
  {
    id: "fabrication-vocabulary",
    label: "Fabrication vocabulary",
    description: "Making things up, described in words other than 'hallucinate'.",
  },
  {
    id: "expectation-gap",
    label: "Human expectation gaps",
    description: "The gap between what humans ask for and what they actually want.",
  },
  {
    id: "context-carryover",
    label: "Context carry-over",
    description: "Earlier conversations and context leaking into new tasks.",
  },
  {
    id: "persistent-wording",
    label: "Persistent or chronic wording",
    description: "Words like persistent, chronic and relentless that signal high severity.",
  },
  {
    id: "negation",
    label: "Negated wording",
    description: "A severity word that is negated, such as 'not severe'.",
  },
  {
    id: "softening-words",
    label: "Softening words",
    description: "Words like mild and occasional that should lower the severity.",
  },
  {
    id: "sarcasm-and-idiom",
    label: "Sarcasm and idiom",
    description: "Meaning carried by sarcasm or an idiom, such as 'far from a crisis'.",
  },
  {
    id: "frequency-vs-intensity",
    label: "Frequency words read as intensity",
    description: "A word like 'constant' that describes how often, not how bad.",
  },
]

const byId = new Map<string, Theme>(THEMES.map((t) => [t.id, t]))

export function getTheme(id: string): Theme | null {
  return byId.get(id) ?? null
}

/** A readable name for a theme id, falling back to the id itself for one that no longer exists. */
export function themeLabel(id: string): string {
  return byId.get(id)?.label ?? id
}
