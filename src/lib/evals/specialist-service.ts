import type { PrismaClient } from "@prisma/client"
import { canCreateSpecialist, canManageSpecialist } from "../guards"
import { resolveInstance } from "./instances"
import { validateOutputs } from "./outputs"
import { runEval, type EvalDb } from "./runner"
import { validateSpecialistConfig, type ValidationError } from "./spec"
import { createSpecialist, loadSpecialist, updateSpecialist, type StoreDb } from "./specialist-store"
import type { Judge } from "./types"

/**
 * What the create, update and import actions do after reading the form: authorise,
 * validate, write, record who did it. Kept apart from the server actions so the rules
 * can be tested. Every function re-checks the caller's role and, for changes, ownership.
 */
export type ServiceDb = EvalDb & StoreDb & Pick<PrismaClient, "specialistVersionRow" | "specialistEvent">

export type ServiceError =
  | { ok: false; code: "forbidden" }
  | { ok: false; code: "not-found" }
  | { ok: false; code: "unknown-instance" }
  | { ok: false; code: "slug-taken" }
  | { ok: false; code: "invalid"; errors: ValidationError[] }
  | { ok: false; code: "failed" }

/** Fixed messages for the codes that have no list of problems. */
export const SERVICE_ERROR_MESSAGES = {
  forbidden: "You do not have permission to do that.",
  "not-found": "That specialist does not exist.",
  "unknown-instance": "That customer instance does not exist.",
  "slug-taken": "A specialist with that slug already exists. Choose another slug.",
  failed: "That could not be saved. Please try again.",
} as const

export type Actor = { id: string; role: string }

async function getDb(db?: ServiceDb): Promise<ServiceDb> {
  return db ?? ((await import("../prisma")).prisma as unknown as ServiceDb)
}

/** Recording who did what is bookkeeping: a problem is logged and never fails the action. */
export async function recordEvent(
  db: Pick<ServiceDb, "specialistEvent">,
  specialistRowId: string,
  type: string,
  actor: Actor
): Promise<void> {
  try {
    await db.specialistEvent.create({ data: { specialistId: specialistRowId, type, actorId: actor.id, actorRole: actor.role } })
  } catch (e) {
    console.error("Failed to record a specialist event", e)
  }
}

export async function createSpecialistFromText(input: {
  actor: Actor
  text: string
  db?: ServiceDb
}): Promise<{ ok: true; slug: string } | ServiceError> {
  if (!canCreateSpecialist(input.actor.role)) return { ok: false, code: "forbidden" }
  const validated = validateSpecialistConfig(input.text)
  if (!validated.ok) return { ok: false, code: "invalid", errors: validated.errors }
  try {
    const db = await getDb(input.db)
    const created = await createSpecialist({ db, spec: validated.spec, ownerId: input.actor.id, actorRole: input.actor.role })
    if (!created.ok) return { ok: false, code: "slug-taken" }
    return { ok: true, slug: validated.spec.slug }
  } catch (e) {
    console.error("Failed to create a specialist", e)
    return { ok: false, code: "failed" }
  }
}

export async function updateSpecialistFromText(input: {
  actor: Actor
  slug: string
  text: string
  db?: ServiceDb
}): Promise<{ ok: true; changed: boolean } | ServiceError> {
  try {
    const db = await getDb(input.db)
    const current = await loadSpecialist(db, input.slug)
    if (!current) return { ok: false, code: "not-found" }
    if (!canManageSpecialist(input.actor.role, input.actor.id, current.ownerId)) return { ok: false, code: "forbidden" }

    const validated = validateSpecialistConfig(input.text)
    if (!validated.ok) return { ok: false, code: "invalid", errors: validated.errors }

    const result = await updateSpecialist({ db, slug: input.slug, spec: validated.spec, actorId: input.actor.id, actorRole: input.actor.role })
    if (!result.ok) {
      return result.code === "INVALID" ? { ok: false, code: "invalid", errors: result.errors } : { ok: false, code: "not-found" }
    }
    return { ok: true, changed: result.changed }
  } catch (e) {
    console.error("Failed to update a specialist", e)
    return { ok: false, code: "failed" }
  }
}

/**
 * Grades what a team's specialist returned. A new version label is registered with its
 * release time first; if the run then fails, a version registered by this call is removed
 * again so a failed import leaves nothing behind.
 */
export async function importOutputsFromText(input: {
  actor: Actor
  slug: string
  instance: string
  text: string
  judge?: Judge | null
  now?: Date
  db?: ServiceDb
}): Promise<{ ok: true; runId: string; verdict: string; newVersion: boolean } | ServiceError> {
  try {
    const db = await getDb(input.db)
    const specialist = await loadSpecialist(db, input.slug)
    if (!specialist) return { ok: false, code: "not-found" }
    if (!canManageSpecialist(input.actor.role, input.actor.id, specialist.ownerId)) return { ok: false, code: "forbidden" }

    const instance = await resolveInstance(db, input.instance)
    if (!instance) return { ok: false, code: "unknown-instance" }

    const validated = validateOutputs(input.text, specialist.spec, specialist.versions, input.now)
    if (!validated.ok) return { ok: false, code: "invalid", errors: validated.errors }
    const { data, isNewVersion } = validated

    // Built-in versions generate their own outputs; importing over one would be confusing.
    const existing = specialist.versions.find((v) => v.label === data.version)
    if (existing?.builtinKey) {
      return { ok: false, code: "invalid", errors: [{ path: "version", message: `${data.version} runs from code. Use a new version label for imported outputs.` }] }
    }

    let createdVersionId: string | null = null
    if (isNewVersion) {
      const row = await db.specialistVersionRow.create({
        data: { specialistId: specialist.id, label: data.version, summary: data.summary, releasedAt: data.releasedAt as Date },
        select: { id: true },
      })
      createdVersionId = row.id
    }

    try {
      const run = await runEval({
        specialistId: input.slug,
        version: data.version,
        instance: instance.slug,
        triggeredBy: input.actor.id,
        judge: input.judge ?? null,
        outputs: data.outputs,
        db,
      })
      await recordEvent(db, specialist.id, "OUTPUTS_IMPORTED", input.actor)
      return { ok: true, runId: run.id, verdict: run.verdict, newVersion: isNewVersion }
    } catch (e) {
      if (createdVersionId) {
        await db.specialistVersionRow.delete({ where: { id: createdVersionId } }).catch((err: unknown) => console.error("Failed to undo a version", err))
      }
      throw e
    }
  } catch (e) {
    console.error("Failed to import outputs", e)
    return { ok: false, code: "failed" }
  }
}
