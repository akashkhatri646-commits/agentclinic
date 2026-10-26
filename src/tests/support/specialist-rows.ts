import { BUILTIN_VERSIONS } from "../../lib/evals/builtin"
import { intakeTriageSpec } from "../../lib/evals/builtin-spec"
import type { SpecialistSpec } from "../../lib/evals/spec"

/** A stored specialist row, as the database returns it, built from a spec. For test doubles. */
export function specialistRow(
  spec: SpecialistSpec,
  versions: { label: string; summary?: string; releasedAt: Date; builtinKey?: string | null }[],
  over: Record<string, unknown> = {}
) {
  return {
    id: `sp-${spec.slug}`,
    slug: spec.slug,
    name: spec.name,
    description: spec.description,
    ownerId: "owner-1",
    outputFields: JSON.stringify(spec.outputFields),
    checks: JSON.stringify(spec.checks),
    themes: JSON.stringify(spec.themes),
    judgeField: spec.judge?.field ?? null,
    isSample: false,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    scenarios: spec.scenarios.map((s, position) => ({
      key: s.id,
      split: s.split,
      theme: s.theme,
      weight: s.weight,
      input: s.input,
      expected: JSON.stringify(s.expected),
      why: s.why,
      position,
    })),
    versions: versions.map((v) => ({ label: v.label, summary: v.summary ?? "", releasedAt: v.releasedAt, builtinKey: v.builtinKey ?? null })),
    ...over,
  }
}

/** The seeded intake-triage specialist with its built-in v1 and v2. */
export const intakeTriageRow = () =>
  specialistRow(
    intakeTriageSpec,
    BUILTIN_VERSIONS.map((b) => ({ label: b.label, summary: b.summary, releasedAt: b.releasedAt, builtinKey: b.key }))
  )

/** The standard clinic instance, which reads the live catalogue. */
export const standardInstanceRow = { slug: "standard-clinic", name: "Standard clinic", description: "", shape: "", referenceLists: null }
