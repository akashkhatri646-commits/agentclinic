/**
 * Reads values out of a submitted form. Form data is user input, so nothing here
 * assumes a shape: each helper returns something the services will validate again.
 * Kept free of Next.js so it can be tested directly.
 */

const text = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined)

/** The effort field: a whole number as text. Missing or empty means "not provided". NaN is passed on so the service refuses it. */
export function parseEffort(v: unknown): number | undefined {
  const s = text(v)
  if (s === undefined || s.trim() === "") return undefined
  return Number(s)
}

/** The severity field: "auto" clears the override, a number sets it, missing or empty means "not provided". */
export function parseSeverityOverride(v: unknown): number | null | undefined {
  const s = text(v)
  if (s === undefined || s.trim() === "") return undefined
  if (s === "auto") return null
  return Number(s)
}

/** The owner field: empty means no owner. */
export function parseOwner(v: unknown): string | null {
  const s = text(v)
  return s === undefined || s.trim() === "" ? null : s.trim()
}

/**
 * A failure mode id taken from a form, used to choose where to redirect. Only plain
 * id characters are accepted, so a forged field cannot send the browser elsewhere.
 */
export function safeModeId(v: unknown): string | null {
  const s = text(v)
  return s !== undefined && /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null
}

/** Where to send the browser after an action: the failure mode's page, with an error code if there was one. */
export function triageRedirect(modeId: string | null, errorCode?: string): string {
  const base = modeId ? `/dashboard/triage/${modeId}` : "/dashboard/triage"
  return errorCode ? `${base}?error=${encodeURIComponent(errorCode)}` : base
}

export { text as formText }
