import { intakeTriageSpec } from "./builtin-spec"
import { SPEC_FORMAT } from "./spec"

/**
 * Starting points offered on the new-specialist page. Each is a complete config that passes
 * validation as it stands (a test checks this). The slug is left for the team to change.
 */
export type Template = { id: string; label: string; summary: string; config: object }

const worked = {
  format: SPEC_FORMAT,
  slug: "my-intake-triage",
  name: intakeTriageSpec.name,
  description: intakeTriageSpec.description,
  outputFields: intakeTriageSpec.outputFields,
  checks: intakeTriageSpec.checks,
  themes: intakeTriageSpec.themes,
  judge: intakeTriageSpec.judge,
  scenarios: intakeTriageSpec.scenarios,
}

type Row = [id: string, split: string, theme: string, weight: number, input: string, category: string]

const classificationRows: Row[] = [
  ["d01", "DEV", "clear-cases", 1, "I was charged twice this month.", "billing"],
  ["d02", "DEV", "clear-cases", 1, "My parcel has not arrived.", "shipping"],
  ["d03", "DEV", "clear-cases", 1, "I need a copy of my invoice.", "billing"],
  ["d04", "DEV", "clear-cases", 1, "The tracking page shows no updates.", "shipping"],
  ["d05", "DEV", "edge-cases", 2, "Refund the delivery fee because the parcel was late.", "billing"],
  ["d06", "DEV", "edge-cases", 2, "Was I billed for the item that never shipped?", "billing"],
  ["d07", "DEV", "edge-cases", 3, "Not a billing problem: the box arrived crushed.", "shipping"],
  ["d08", "DEV", "clear-cases", 1, "Please update my card details.", "billing"],
  ["h01", "HOLDOUT", "clear-cases", 1, "Why is there an extra charge on my statement?", "billing"],
  ["h02", "HOLDOUT", "clear-cases", 1, "When will my order be dispatched?", "shipping"],
  ["h03", "HOLDOUT", "edge-cases", 2, "I returned the parcel; where is my money?", "billing"],
  ["h04", "HOLDOUT", "edge-cases", 2, "The courier left it with a neighbour I do not know.", "shipping"],
]

const classification = {
  format: SPEC_FORMAT,
  slug: "my-classifier",
  name: "My classifier",
  description: "Assigns each request to one category.",
  outputFields: [{ name: "category", description: "The category the request belongs to." }],
  checks: [{ field: "category", type: "equals" }],
  themes: [
    { id: "clear-cases", label: "Clear cases", description: "Requests that plainly belong to one category." },
    { id: "edge-cases", label: "Edge cases", description: "Ambiguous or tricky wording." },
  ],
  scenarios: classificationRows.map(([id, split, theme, weight, input, category]) => ({
    id,
    split,
    theme,
    weight,
    input,
    expected: { category },
    why: "Replace this with the reason the expected answer is right.",
  })),
}

const blank = {
  format: SPEC_FORMAT,
  slug: "my-specialist",
  name: "My specialist",
  description: "",
  outputFields: [{ name: "answer", description: "What the specialist returns." }],
  checks: [{ field: "answer", type: "equals" }],
  themes: [{ id: "general", label: "General", description: "" }],
  scenarios: [
    { id: "d01", split: "DEV", theme: "general", weight: 1, input: "An example input.", expected: { answer: "an example answer" }, why: "" },
  ],
}

export const TEMPLATES: Template[] = [
  {
    id: "intake-triage",
    label: "Intake triage (worked example)",
    summary: "The clinic's own specialist: severity, therapy and rationale, with 32 scenarios across 10 themes and an LLM judge on the rationale.",
    config: worked,
  },
  {
    id: "classification",
    label: "Classification starter",
    summary: "One category field, an equals check, and 12 scenarios across two themes with a hold-out set.",
    config: classification,
  },
  {
    id: "blank",
    label: "Blank starter",
    summary: "The smallest valid config: one field, one check, one theme, one scenario.",
    config: blank,
  },
]

export function getTemplate(id: string): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null
}

export const templateText = (t: Template): string => JSON.stringify(t.config, null, 2)
