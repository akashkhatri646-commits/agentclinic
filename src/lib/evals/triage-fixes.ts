import type { PrismaClient } from "@prisma/client"
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  type ServiceResult,
  type TriageErrorCode,
} from "./triage-errors"
import { canTransition, isFixStatus, isLevel, type FixStatus } from "./triage"

/** The slice of the database client these services use, so the seed and tests can supply their own. */
export type FixDb = Pick<
  PrismaClient,
  "failureMode" | "fix" | "fixEvent" | "user" | "notification" | "specialist" | "$transaction"
>

const fail = (code: TriageErrorCode): { ok: false; code: TriageErrorCode } => ({ ok: false, code })

/** The shared client is loaded only when the caller did not pass one (see the runner for why). */
async function getDb(db?: FixDb): Promise<FixDb> {
  return db ?? ((await import("../prisma")).prisma as unknown as FixDb)
}

/* ───────────────────────── validation ───────────────────────── */

export function normalizeTitle(value: unknown): string | null {
  if (typeof value !== "string") return null
  const title = value.trim()
  return title.length >= 1 && title.length <= MAX_TITLE_LENGTH ? title : null
}

/** Empty text becomes null; text over the limit is invalid (returns undefined). */
export function normalizeDescription(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return undefined
  const text = value.trim()
  if (text.length > MAX_DESCRIPTION_LENGTH) return undefined
  return text === "" ? null : text
}

/** An owner must be an existing staff or admin user. */
async function findOwner(db: FixDb, ownerId: string) {
  const user = await db.user.findUnique({ where: { id: ownerId }, select: { id: true, role: true, email: true } })
  return user && (user.role === "STAFF" || user.role === "ADMIN") ? user : null
}

/** Fail-soft and uses the client it was given. Never notifies the person who made the change. */
async function notifyOwner(
  db: FixDb,
  ownerId: string | null,
  actorId: string | null,
  message: string,
  failureModeId: string
): Promise<void> {
  if (!ownerId || ownerId === actorId) return
  try {
    await db.notification.create({
      data: { userId: ownerId, message, href: `/dashboard/triage/${failureModeId}` },
    })
  } catch (e) {
    console.error("Failed to create a triage notification", e)
  }
}

/* ───────────────────────── fixes ───────────────────────── */

export type CreateFixInput = {
  failureModeId: string
  title: unknown
  description?: unknown
  ownerId?: string | null
  actorId: string
  /** Defaults to now. The seed passes a backdated time. */
  at?: Date
  /** Illustrative seed data. Sample fixes never send notifications. */
  isSample?: boolean
}

export async function createFix(input: CreateFixInput, db?: FixDb): Promise<ServiceResult<{ id: string }>> {
  const client = await getDb(db)
  const title = normalizeTitle(input.title)
  if (!title) return fail("invalid-title")
  const description = normalizeDescription(input.description)
  if (description === undefined) return fail("invalid-description")

  const mode = await client.failureMode.findUnique({ where: { id: input.failureModeId }, select: { id: true } })
  if (!mode) return fail("not-found")

  let ownerNote = "No owner yet."
  if (input.ownerId) {
    const owner = await findOwner(client, input.ownerId)
    if (!owner) return fail("invalid-owner")
    ownerNote = `Owner: ${owner.email}.`
  }

  const at = input.at ?? new Date()
  const fix = await client.fix.create({
    data: {
      failureModeId: input.failureModeId,
      title,
      description,
      ownerId: input.ownerId ?? null,
      status: "PROPOSED",
      createdById: input.actorId,
      isSample: input.isSample ?? false,
      createdAt: at,
      // Written together with the fix, so a fix never exists without its first history entry.
      events: {
        create: { at, actorId: input.actorId, kind: "CREATED", toStatus: "PROPOSED", note: ownerNote },
      },
    },
    select: { id: true },
  })

  if (!input.isSample) {
    await notifyOwner(client, input.ownerId ?? null, input.actorId, `You were assigned a fix: "${title}".`, input.failureModeId)
  }
  return { ok: true, value: { id: fix.id } }
}

export type ChangeStatusInput = {
  fixId: string
  to: unknown
  /** Required when moving to SHIPPED. */
  shippedVersion?: unknown
  actorId: string
  at?: Date
}

/**
 * Moves a fix one stage. Only the moves in `canTransition` are allowed, and VERIFIED
 * is never one of them: only a run can verify a fix (see triage-sync.ts).
 */
export async function changeFixStatus(input: ChangeStatusInput, db?: FixDb): Promise<ServiceResult<{ id: string }>> {
  const client = await getDb(db)
  if (!isFixStatus(input.to)) return fail("invalid-transition")
  const to: FixStatus = input.to

  const fix = await client.fix.findUnique({
    where: { id: input.fixId },
    select: { id: true, status: true, failureMode: { select: { specialistId: true } } },
  })
  if (!fix) return fail("not-found")
  if (!isFixStatus(fix.status) || !canTransition(fix.status, to)) return fail("invalid-transition")

  const at = input.at ?? new Date()
  let data: Record<string, unknown> = { status: to }
  let note: string | null = null

  if (to === "SHIPPED") {
    if (typeof input.shippedVersion !== "string" || input.shippedVersion === "") return fail("version-required")
    const known = await client.specialist.findFirst({
      where: { slug: fix.failureMode.specialistId, versions: { some: { label: input.shippedVersion } } },
      select: { id: true },
    })
    if (!known) return fail("invalid-version")
    data = { status: to, shippedVersion: input.shippedVersion, shippedAt: at }
    note = `Shipped in ${input.shippedVersion}.`
  } else if (fix.status === "SHIPPED") {
    // Stepping back from shipped: it is no longer shipped anywhere.
    data = { status: to, shippedVersion: null, shippedAt: null }
    note = "Moved back from shipped."
  }

  await client.$transaction([
    client.fix.update({ where: { id: fix.id }, data }),
    client.fixEvent.create({
      data: { fixId: fix.id, at, actorId: input.actorId, kind: "STATUS", fromStatus: fix.status, toStatus: to, note },
    }),
  ])
  return { ok: true, value: { id: fix.id } }
}

export type ChangeOwnerInput = { fixId: string; ownerId: string | null; actorId: string; at?: Date }

export async function changeFixOwner(input: ChangeOwnerInput, db?: FixDb): Promise<ServiceResult<{ id: string }>> {
  const client = await getDb(db)
  const fix = await client.fix.findUnique({
    where: { id: input.fixId },
    select: { id: true, status: true, ownerId: true, failureModeId: true, title: true, isSample: true },
  })
  if (!fix) return fail("not-found")

  let note = "Owner cleared."
  if (input.ownerId) {
    const owner = await findOwner(client, input.ownerId)
    if (!owner) return fail("invalid-owner")
    note = `Owner set to ${owner.email}.`
  }

  await client.$transaction([
    client.fix.update({ where: { id: fix.id }, data: { ownerId: input.ownerId } }),
    client.fixEvent.create({
      data: { fixId: fix.id, at: input.at ?? new Date(), actorId: input.actorId, kind: "OWNER", fromStatus: fix.status, toStatus: fix.status, note },
    }),
  ])

  if (!fix.isSample && input.ownerId && input.ownerId !== fix.ownerId) {
    await notifyOwner(client, input.ownerId, input.actorId, `You were assigned a fix: "${fix.title}".`, fix.failureModeId)
  }
  return { ok: true, value: { id: fix.id } }
}

/* ───────────────────────── score inputs ───────────────────────── */

export type ModeInputs = {
  failureModeId: string
  /** 1 (S) to 3 (L). Leave out to keep the current value. */
  effort?: unknown
  /** 1 to 3, or null to go back to the suggestion. Leave out to keep the current value. */
  severityOverride?: unknown
}

export async function updateModeInputs(input: ModeInputs, db?: FixDb): Promise<ServiceResult<{ id: string }>> {
  const client = await getDb(db)
  const data: { effort?: number; severityOverride?: number | null } = {}

  if (input.effort !== undefined) {
    if (!isLevel(input.effort)) return fail("invalid-effort")
    data.effort = input.effort
  }
  if (input.severityOverride !== undefined) {
    if (input.severityOverride !== null && !isLevel(input.severityOverride)) return fail("invalid-severity")
    data.severityOverride = input.severityOverride
  }

  const mode = await client.failureMode.findUnique({ where: { id: input.failureModeId }, select: { id: true, theme: true } })
  if (!mode) return fail("not-found")
  if (Object.keys(data).length > 0) await client.failureMode.update({ where: { id: mode.id }, data })
  return { ok: true, value: { id: mode.id } }
}
