/**
 * SQLite (with the Prisma version used here) has no list or JSON column, so lists
 * of scenario ids are stored as JSON text. These two helpers are the only place
 * that reads or writes that text.
 */

/** Reads a stored list. Anything that is not a JSON array of strings reads as an empty list. */
export function parseIdList(text: string | null | undefined): string[] {
  if (!text) return []
  try {
    const value: unknown = JSON.parse(text)
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

/** Writes a list in a stable order, so storing the same ids twice gives the same text. */
export function formatIdList(ids: string[]): string {
  return JSON.stringify(Array.from(new Set(ids)).sort())
}
