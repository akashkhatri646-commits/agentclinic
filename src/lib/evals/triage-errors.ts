/**
 * Everything that can go wrong when staff change triage data. Actions report a
 * short code in the URL and the page shows the fixed message for it, so text taken
 * from the URL is never displayed (the same approach as the Evals pages).
 */
export type TriageErrorCode =
  | "forbidden"
  | "not-found"
  | "invalid-title"
  | "invalid-description"
  | "invalid-owner"
  | "invalid-effort"
  | "invalid-severity"
  | "version-required"
  | "invalid-version"
  | "invalid-transition"

export const TRIAGE_ERROR_MESSAGES: Record<TriageErrorCode, string> = {
  forbidden: "You do not have access to change triage data.",
  "not-found": "That failure mode or fix no longer exists.",
  "invalid-title": "A fix needs a title of 1 to 120 characters.",
  "invalid-description": "A description can be at most 1000 characters.",
  "invalid-owner": "The owner must be a staff or admin user.",
  "invalid-effort": "Effort must be S, M or L.",
  "invalid-severity": "Severity must be 1, 2 or 3, or left on the suggestion.",
  "version-required": "Choose the version this fix shipped in.",
  "invalid-version": "That specialist version does not exist.",
  "invalid-transition": "A fix cannot move to that status from where it is. Only a run can verify a fix.",
}

export function isTriageErrorCode(value: string | undefined): value is TriageErrorCode {
  return value !== undefined && Object.prototype.hasOwnProperty.call(TRIAGE_ERROR_MESSAGES, value)
}

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; code: TriageErrorCode }

export const MAX_TITLE_LENGTH = 120
export const MAX_DESCRIPTION_LENGTH = 1000
