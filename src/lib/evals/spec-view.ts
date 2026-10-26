import { SPEC_FORMAT, type Check, type SpecialistSpec } from "./spec"

/** Words and text for showing a specialist's definition to people. Pure. */

/** A check in plain words, for the specialist page. */
export function describeCheck(check: Check): string {
  switch (check.type) {
    case "equals":
      return `${check.field} must equal the scenario's expected value`
    case "oneOf":
      return `${check.field} must be one of: ${check.values.join(", ")}`
    case "inReference":
      return `${check.field} must be in the environment's "${check.list}" list`
    case "nonEmpty":
      return `${check.field} must not be empty`
  }
}

const EVENT_LABEL: Record<string, string> = {
  CREATED: "Created the specialist",
  UPDATED: "Changed the definition",
  OUTPUTS_IMPORTED: "Imported outputs",
  RUN_STARTED: "Started a run",
}

export function describeSpecialistEvent(type: string): string {
  return EVENT_LABEL[type] ?? type.replace(/_/g, " ").toLowerCase()
}

/** The definition as the JSON a team would paste: what the edit page starts from. */
export function configTextOf(spec: SpecialistSpec): string {
  return JSON.stringify(
    {
      format: SPEC_FORMAT,
      slug: spec.slug,
      name: spec.name,
      description: spec.description,
      outputFields: spec.outputFields,
      checks: spec.checks,
      themes: spec.themes,
      ...(spec.judge ? { judge: spec.judge } : {}),
      scenarios: spec.scenarios,
    },
    null,
    2
  )
}

/** The next version label to suggest: v1 for none, otherwise one more than the highest vN, else "next". */
export function suggestNextVersion(labels: string[]): string {
  const numbers = labels.map((l) => /^v(\d+)$/.exec(l)).filter((m): m is RegExpExecArray => m !== null).map((m) => Number(m[1]))
  if (labels.length === 0) return "v1"
  return numbers.length > 0 ? `v${Math.max(...numbers) + 1}` : "next"
}
