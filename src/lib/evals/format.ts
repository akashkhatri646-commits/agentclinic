/**
 * Dates are shown in UTC so the same run or fix reads the same wherever the
 * server runs, and the pages say so.
 */
export function formatDateUtc(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" }) : "unknown"
}

export function formatDateTimeUtc(d: Date | null | undefined): string {
  return d ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) : "unknown"
}

/**
 * Turns a stored failure category (such as "MISMATCH:severity+EMPTY:rationale") into words
 * for people: "severity did not match, rationale was empty".
 */
export function describeCategory(category: string | null): string {
  if (!category) return "unknown"
  const PHRASE: Record<string, string> = {
    MISMATCH: "did not match",
    NOT_ALLOWED: "was not an allowed value",
    NOT_IN_REFERENCE: "was not in the environment's list",
    EMPTY: "was empty",
    JUDGE: "was scored too low by the judge",
  }
  return category
    .split("+")
    .map((part) => {
      const [type, field] = part.split(":")
      const phrase = PHRASE[type]
      return phrase && field ? `${field} ${phrase}` : part.replace(/_/g, " ").toLowerCase()
    })
    .join(", ")
}
