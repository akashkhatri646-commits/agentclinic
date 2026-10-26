import type { PrismaClient } from "@prisma/client"
import { SEEDED_THERAPY_NAMES, THERAPY } from "./catalogue"
import type { ReferenceLists } from "./grade"

/**
 * Customer instances: named environments an evaluation can run against. The standard clinic
 * reads the live therapy catalogue; the others carry a fixed snapshot of their reference lists.
 */
export const STANDARD_INSTANCE = "standard-clinic"

export type InstanceDef = {
  slug: string
  name: string
  description: string
  shape: string
  /** Fixed lists, or null to read the live catalogue. */
  referenceLists: ReferenceLists | null
}

export const SEEDED_INSTANCES: InstanceDef[] = [
  {
    slug: STANDARD_INSTANCE,
    name: "Standard clinic",
    description: "The full therapy catalogue, read live from this clinic.",
    shape: "Complete catalogue",
    referenceLists: null,
  },
  {
    slug: "short-staffed-clinic",
    name: "Short-staffed clinic",
    description: "A clinic that does not offer Human Expectation Recalibration.",
    shape: "Missing a therapy",
    referenceLists: { therapies: SEEDED_THERAPY_NAMES.filter((n) => n !== THERAPY.EXPECTATION_RECALIBRATION) },
  },
  {
    slug: "regional-catalogue",
    name: "Regional catalogue",
    description: "A regional chain that renamed several therapies.",
    shape: "Renamed therapies",
    referenceLists: {
      therapies: [
        "Prompt Cleanse",
        THERAPY.CONTEXT_WINDOW_CLEANSE,
        "Hallucination Therapy",
        THERAPY.TOKEN_BUDGET_RELIEF,
        THERAPY.EXPECTATION_RECALIBRATION,
      ],
    },
  },
]

export type InstanceDb = Pick<PrismaClient, "instance" | "therapy">

export type InstanceRow = { slug: string; name: string; description: string; shape: string; referenceLists: string | null }

/** Reads a stored list set. Null means "read the live catalogue"; damaged text reads as no lists. */
export function parseReferenceLists(text: string | null | undefined): ReferenceLists | null {
  if (!text) return null
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
    const lists: ReferenceLists = {}
    for (const [key, items] of Object.entries(value)) {
      if (Array.isArray(items)) lists[key] = items.filter((i): i is string => typeof i === "string")
    }
    return lists
  } catch {
    return {}
  }
}

/** The standard clinic comes first, then the rest in the order they were created. */
export async function listInstances(db: Pick<InstanceDb, "instance">): Promise<InstanceRow[]> {
  const rows = await db.instance.findMany()
  return [...rows].sort((a, b) => Number(b.slug === STANDARD_INSTANCE) - Number(a.slug === STANDARD_INSTANCE))
}

export type ResolvedInstance = { slug: string; name: string; lists: ReferenceLists }

/** The reference lists of one instance, or null if there is no such instance. */
export async function resolveInstance(db: InstanceDb, slug: string): Promise<ResolvedInstance | null> {
  const row = await db.instance.findUnique({ where: { slug } })
  if (!row) return null
  const fixed = parseReferenceLists(row.referenceLists)
  if (fixed) return { slug: row.slug, name: row.name, lists: fixed }
  const therapies = (await db.therapy.findMany({ select: { name: true } })).map((t) => t.name)
  return { slug: row.slug, name: row.name, lists: { therapies } }
}

/**
 * Instance names in the order the instances are listed (standard clinic first), for the notes that
 * say which instances stand behind a number. Unknown slugs keep their own text and go last.
 */
export function instanceNames(slugs: string[], instances: { slug: string; name: string }[]): string[] {
  const order = new Map(instances.map((i, index) => [i.slug, index]))
  const name = new Map(instances.map((i) => [i.slug, i.name]))
  return Array.from(new Set(slugs))
    .sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity) || a.localeCompare(b))
    .map((s) => name.get(s) ?? s)
}
