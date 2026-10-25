/** Therapy names as seeded in prisma/seed.ts. Scenarios and specialists refer to therapies by name. */
export const THERAPY = {
  PROMPT_DETOX: "Prompt Detox",
  CONTEXT_WINDOW_CLEANSE: "Context Window Cleanse",
  HALLUCINATION_CBT: "Hallucination CBT",
  TOKEN_BUDGET_RELIEF: "Token Budget Anxiety Relief",
  EXPECTATION_RECALIBRATION: "Human Expectation Recalibration",
} as const

export const SEEDED_THERAPY_NAMES: string[] = Object.values(THERAPY)
