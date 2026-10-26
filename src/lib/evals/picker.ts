import type { SpecialistSummary } from "./specialist-store"

/**
 * Chooses which specialist a page shows from the `?specialist=` query value. An unknown or
 * missing value falls back to the first specialist created, so a crafted link cannot select
 * anything that does not exist. `selected` is null only when there are no specialists.
 */
export function pickSpecialist<T extends { slug: string }>(specialists: T[], requested: string | undefined): T | null {
  if (specialists.length === 0) return null
  return specialists.find((s) => s.slug === requested) ?? specialists[0]
}

/** Adds the chosen specialist to a link between the specialist-aware pages. */
export function withSpecialist(href: string, slug: string | null | undefined): string {
  if (!slug) return href
  return `${href}${href.includes("?") ? "&" : "?"}specialist=${encodeURIComponent(slug)}`
}

export type PickerSpecialist = Pick<SpecialistSummary, "slug" | "name">
