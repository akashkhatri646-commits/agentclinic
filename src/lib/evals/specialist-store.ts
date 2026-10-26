import type { PrismaClient } from "@prisma/client"
import { SPEC_FORMAT, validateSpecialistConfig, type SpecialistSpec, type ValidationError } from "./spec"

/**
 * Specialists as database rows. The definition (fields, checks, themes) is stored as JSON text
 * and always read back through the same validation a pasted config goes through, so a damaged
 * row is reported instead of half-trusted.
 */
export type StoreDb = Pick<PrismaClient, "specialist" | "specialistScenario" | "specialistEvent" | "evalRun" | "$transaction">

export type StoredVersion = { label: string; summary: string; releasedAt: Date; builtinKey: string | null }

export type LoadedSpecialist = {
  id: string
  spec: SpecialistSpec
  ownerId: string
  isSample: boolean
  createdAt: Date
  /** Ordered by release time, oldest first. */
  versions: StoredVersion[]
}

type ScenarioRow = { key: string; split: string; theme: string; weight: number; input: string; expected: string; why: string; position: number }
type SpecialistRow = {
  id: string
  slug: string
  name: string
  description: string
  ownerId: string
  outputFields: string
  checks: string
  themes: string
  judgeField: string | null
  isSample: boolean
  createdAt: Date
  scenarios: ScenarioRow[]
  versions: StoredVersion[]
}

/** 20 times the submitted-text limit: defaults added on reading back can only grow it a little. */
const STORED_MAX_BYTES = 4 * 1024 * 1024

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Rebuilds the spec from a stored row by running it back through validation. */
export function rowToSpec(row: SpecialistRow): SpecialistSpec {
  const scenarios = [...row.scenarios].sort((a, b) => a.position - b.position)
  const config = {
    format: SPEC_FORMAT,
    slug: row.slug,
    name: row.name,
    description: row.description,
    outputFields: parseJson(row.outputFields),
    checks: parseJson(row.checks),
    themes: parseJson(row.themes),
    ...(row.judgeField ? { judge: { field: row.judgeField } } : {}),
    scenarios: scenarios.map((s) => ({
      id: s.key,
      split: s.split,
      theme: s.theme,
      weight: s.weight,
      input: s.input,
      expected: parseJson(s.expected),
      why: s.why,
    })),
  }
  // A stored definition is read back with a generous size limit: the limit is for what a person submits.
  const result = validateSpecialistConfig(JSON.stringify(config), STORED_MAX_BYTES)
  if (!result.ok) {
    throw new Error(`Specialist "${row.slug}" is stored in a damaged form: ${result.errors[0].path} ${result.errors[0].message}`)
  }
  return result.spec
}

const withParts = {
  scenarios: true,
  versions: { orderBy: { releasedAt: "asc" as const } },
}

export async function loadSpecialist(db: Pick<StoreDb, "specialist">, slug: string): Promise<LoadedSpecialist | null> {
  const row = await db.specialist.findUnique({ where: { slug }, include: withParts })
  if (!row) return null
  return {
    id: row.id,
    spec: rowToSpec(row),
    ownerId: row.ownerId,
    isSample: row.isSample,
    createdAt: row.createdAt,
    versions: row.versions.map((v) => ({ label: v.label, summary: v.summary, releasedAt: v.releasedAt, builtinKey: v.builtinKey })),
  }
}

export type SpecialistSummary = {
  slug: string
  name: string
  description: string
  ownerId: string
  ownerEmail: string
  isSample: boolean
  createdAt: Date
  scenarioCount: number
  versionCount: number
}

/** Oldest first, so the first specialist created is the default one. */
export async function listSpecialists(db: Pick<StoreDb, "specialist">): Promise<SpecialistSummary[]> {
  const rows = await db.specialist.findMany({
    orderBy: { createdAt: "asc" },
    include: { owner: { select: { email: true } }, _count: { select: { scenarios: true, versions: true } } },
  })
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    description: r.description,
    ownerId: r.ownerId,
    ownerEmail: r.owner.email,
    isSample: r.isSample,
    createdAt: r.createdAt,
    scenarioCount: r._count.scenarios,
    versionCount: r._count.versions,
  }))
}

const serialise = (spec: SpecialistSpec) => ({
  name: spec.name,
  description: spec.description,
  outputFields: JSON.stringify(spec.outputFields),
  checks: JSON.stringify(spec.checks),
  themes: JSON.stringify(spec.themes),
  judgeField: spec.judge?.field ?? null,
})

const scenarioRows = (spec: SpecialistSpec) =>
  spec.scenarios.map((s, position) => ({
    key: s.id,
    split: s.split,
    theme: s.theme,
    weight: s.weight,
    input: s.input,
    expected: JSON.stringify(s.expected),
    why: s.why,
    position,
  }))

export type CreateResult = { ok: true; id: string } | { ok: false; code: "SLUG_TAKEN" }

export async function createSpecialist(input: {
  db: Pick<StoreDb, "specialist">
  spec: SpecialistSpec
  ownerId: string
  actorRole: string
  isSample?: boolean
  createdAt?: Date
}): Promise<CreateResult> {
  const { db, spec, ownerId, actorRole, isSample = false, createdAt } = input
  if (await db.specialist.findUnique({ where: { slug: spec.slug }, select: { id: true } })) {
    return { ok: false, code: "SLUG_TAKEN" }
  }
  try {
    const created = await db.specialist.create({
      data: {
        slug: spec.slug,
        ownerId,
        isSample,
        ...(createdAt ? { createdAt } : {}),
        ...serialise(spec),
        scenarios: { create: scenarioRows(spec) },
        events: { create: { type: "CREATED", actorId: ownerId, actorRole, isSample, ...(createdAt ? { createdAt } : {}) } },
      },
      select: { id: true },
    })
    return { ok: true, id: created.id }
  } catch (e) {
    // Two people creating the same slug at once: the database's unique index decides.
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") return { ok: false, code: "SLUG_TAKEN" }
    throw e
  }
}

/**
 * Once a specialist has runs, its stored results and failure modes refer to its scenarios,
 * fields, themes and checks, so a new definition may add and reword but not remove or move
 * what exists. Returns the problems, each naming what was lost.
 */
export function checkDefinitionChange(before: SpecialistSpec, after: SpecialistSpec, hasRuns: boolean): ValidationError[] {
  const errors: ValidationError[] = []
  if (before.slug !== after.slug) {
    errors.push({ path: "slug", message: `cannot be changed (it is "${before.slug}")` })
  }
  if (!hasRuns) return errors

  const missing = (what: string, path: string, old: string[], now: string[]) => {
    for (const item of old.filter((o) => !now.includes(o))) {
      errors.push({ path, message: `${what} "${item}" is used by existing runs and cannot be removed or renamed` })
    }
  }
  missing("scenario", "scenarios", before.scenarios.map((s) => s.id), after.scenarios.map((s) => s.id))
  missing("output field", "outputFields", before.outputFields.map((f) => f.name), after.outputFields.map((f) => f.name))
  missing("theme", "themes", before.themes.map((t) => t.id), after.themes.map((t) => t.id))
  missing("check", "checks", before.checks.map((c) => JSON.stringify(c)), after.checks.map((c) => JSON.stringify(c)))

  for (const old of before.scenarios) {
    const now = after.scenarios.find((s) => s.id === old.id)
    if (now && now.split !== old.split) {
      errors.push({ path: "scenarios", message: `scenario "${old.id}" moved from ${old.split} to ${now.split}, which would change what existing runs mean` })
    }
    if (now && now.theme !== old.theme) {
      errors.push({ path: "scenarios", message: `scenario "${old.id}" changed theme, which would change what existing failure modes mean` })
    }
  }
  return errors
}

export type UpdateResult =
  | { ok: true; changed: boolean }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "INVALID"; errors: ValidationError[] }

export async function updateSpecialist(input: {
  db: StoreDb
  slug: string
  spec: SpecialistSpec
  actorId: string
  actorRole: string
}): Promise<UpdateResult> {
  const { db, slug, spec, actorId, actorRole } = input
  const current = await loadSpecialist(db, slug)
  if (!current) return { ok: false, code: "NOT_FOUND" }

  const hasRuns = (await db.evalRun.count({ where: { specialistId: slug } })) > 0
  const errors = checkDefinitionChange(current.spec, spec, hasRuns)
  if (errors.length > 0) return { ok: false, code: "INVALID", errors }

  if (JSON.stringify(current.spec) === JSON.stringify(spec)) return { ok: true, changed: false }

  await db.$transaction([
    db.specialist.update({ where: { id: current.id }, data: serialise(spec) }),
    db.specialistScenario.deleteMany({ where: { specialistId: current.id } }),
    db.specialistScenario.createMany({ data: scenarioRows(spec).map((r) => ({ ...r, specialistId: current.id })) }),
    db.specialistEvent.create({ data: { specialistId: current.id, type: "UPDATED", actorId, actorRole } }),
  ])
  return { ok: true, changed: true }
}
