import type { OutputValues, ReferenceLists } from "./grade"
import { SPECIALIST_VERSIONS } from "./specialists"

/**
 * Specialist versions that generate their outputs from code. Their key is stored on the
 * version row as `builtinKey`; every other version gets its outputs by import.
 */
export const builtinKey = (slug: string, label: string) => `${slug}/${label}`

export type BuiltinVersion = { key: string; slug: string; label: string; summary: string; releasedAt: Date }

export const BUILTIN_VERSIONS: BuiltinVersion[] = SPECIALIST_VERSIONS.map((v) => ({
  key: builtinKey(v.specialistId, v.version),
  slug: v.specialistId,
  label: v.version,
  summary: v.summary,
  releasedAt: v.releasedAt,
}))

/** Produces the output for one input, or null when the key is not a built-in version. */
export function getBuiltinRunner(
  key: string | null | undefined
): ((input: string, lists: ReferenceLists) => OutputValues) | null {
  const version = SPECIALIST_VERSIONS.find((v) => builtinKey(v.specialistId, v.version) === key)
  if (!version) return null
  return (input, lists) => {
    const out = version.run({ description: input, therapies: lists.therapies ?? [] })
    return { severity: out.severity, therapy: out.therapy, rationale: out.rationale }
  }
}
