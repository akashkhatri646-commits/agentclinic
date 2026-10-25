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
