import type { SpecialistVersion } from "../types"
import { INTAKE_TRIAGE_ID, intakeTriageV1 } from "./intake-triage-v1"
import { intakeTriageV2 } from "./intake-triage-v2"

export { INTAKE_TRIAGE_ID }

/** Registered versions in release order. Add new versions to the end. */
export const SPECIALIST_VERSIONS: SpecialistVersion[] = [intakeTriageV1, intakeTriageV2]

export function listVersions(specialistId: string): SpecialistVersion[] {
  return SPECIALIST_VERSIONS.filter((s) => s.specialistId === specialistId)
}

export function getSpecialistVersion(
  specialistId: string,
  version: string
): SpecialistVersion | null {
  return (
    SPECIALIST_VERSIONS.find((s) => s.specialistId === specialistId && s.version === version) ??
    null
  )
}

/** The version released immediately before `version`, or null for the first one. */
export function getPreviousVersion(
  specialistId: string,
  version: string
): SpecialistVersion | null {
  const versions = listVersions(specialistId)
  const index = versions.findIndex((s) => s.version === version)
  return index > 0 ? versions[index - 1] : null
}
