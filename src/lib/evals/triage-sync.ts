import type { Prisma, PrismaClient } from "@prisma/client"
import { formatIdList, parseIdList } from "./id-list"
import { mergeLatestPerInstance } from "./merge"
import { loadSpecialist } from "./specialist-store"
import { isEmptyPlan, planSync, type FixState, type FixStatus, type ModeState } from "./triage"

/** The slice of the database client the sync needs, so the seed and tests can supply their own. */
export type TriageDb = Pick<
  PrismaClient,
  "failureMode" | "fix" | "fixEvent" | "evalRun" | "notification" | "specialist" | "$transaction"
>

/** The parts of a stored eval run the sync reads. A run loaded with its results satisfies this. */
export type SyncableRun = {
  id: string
  specialistId: string
  version: string
  createdAt: Date
  finishedAt: Date | null
  results: { scenarioId: string; passed: boolean }[]
}

export type SyncSummary = { created: number; updated: number; verified: number; reappeared: number }

const NOTHING: SyncSummary = { created: 0, updated: 0, verified: 0, reappeared: 0 }

/**
 * Brings the failure modes and fixes up to date after an eval run: opens, refreshes,
 * resolves and reopens failure modes, verifies shipped fixes that the run proves, and
 * tells the owners. The decisions are made by the pure `planSync`; this only loads
 * state, writes the result in one transaction, and sends notifications afterwards.
 *
 * Throws if the data cannot be read or written, so the caller decides how to react
 * (the runner logs it and carries on). A failure to notify never throws.
 */
export async function syncFailureModes(run: SyncableRun, db: TriageDb): Promise<SyncSummary> {
  const loaded = await loadSpecialist(db, run.specialistId)
  if (!loaded) return NOTHING
  const versionOrder = loaded.versions.map((v) => v.label)
  const scenarios = loaded.spec.scenarios.map((s) => ({ id: s.id, theme: s.theme, weight: s.weight }))
  const themeOrder = loaded.spec.themes.map((t) => t.id)
  const labels: Record<string, string> = Object.fromEntries(loaded.spec.themes.map((t) => [t.id, t.label]))
  if (scenarios.length === 0 || !versionOrder.includes(run.version)) return NOTHING

  const previousVersion = versionOrder[versionOrder.indexOf(run.version) - 1] ?? null
  // The state of a version is the worst case across instances: the latest run on each
  // instance, as of the time of this run. Runs made after it are not part of its history.
  const runsOf = (version: string) =>
    db.evalRun.findMany({
      where: { specialistId: run.specialistId, version, createdAt: { lte: run.createdAt } },
      select: { instanceSlug: true, createdAt: true, results: { select: { scenarioId: true, passed: true } } },
    })
  const [modeRows, fixRows, versionRuns, previousRuns] = await Promise.all([
    db.failureMode.findMany({ where: { specialistId: run.specialistId } }),
    db.fix.findMany({
      where: { failureMode: { specialistId: run.specialistId }, status: { in: ["SHIPPED", "VERIFIED"] } },
      select: { id: true, failureModeId: true, title: true, status: true, shippedVersion: true, ownerId: true, isSample: true },
    }),
    runsOf(run.version),
    previousVersion ? runsOf(previousVersion) : Promise.resolve([]),
  ])
  // The run being synced is always part of its own version's state, even if the database
  // has not returned it yet (a caller may pass a run it has not stored in full).
  const merged = mergeLatestPerInstance(
    versionRuns.length > 0 ? versionRuns : [{ instanceSlug: "standard-clinic", createdAt: run.createdAt, results: run.results }]
  )
  const previousRun = previousRuns.length > 0 ? { results: mergeLatestPerInstance(previousRuns).results } : null

  const modes: ModeState[] = modeRows.map((m) => ({
    id: m.id,
    theme: m.theme,
    status: m.status === "RESOLVED" ? "RESOLVED" : "OPEN",
    frequency: m.frequency,
    failingScenarioIds: parseIdList(m.failingScenarioIds),
    regressedScenarioIds: parseIdList(m.regressedScenarioIds),
    suggestedSeverity: m.suggestedSeverity,
    lastRunId: m.lastRunId,
    lastRunVersion: m.lastRunVersion,
  }))
  const fixes: FixState[] = fixRows.map((f) => ({
    id: f.id,
    failureModeId: f.failureModeId,
    title: f.title,
    status: f.status as FixStatus,
    shippedVersion: f.shippedVersion,
    ownerId: f.ownerId,
  }))
  const sampleFixIds = new Set(fixRows.filter((f) => f.isSample).map((f) => f.id))

  const finishedAt = run.finishedAt ?? run.createdAt
  const plan = planSync({
    run: { id: run.id, version: run.version, finishedAt, results: merged.results },
    scenarios,
    themeOrder,
    modes,
    fixes,
    versionOrder,
    previousRun,
  })
  if (isEmptyPlan(plan)) return NOTHING

  const ops: Prisma.PrismaPromise<unknown>[] = []

  for (const c of plan.creates) {
    ops.push(
      db.failureMode.create({
        data: {
          specialistId: run.specialistId,
          theme: c.theme,
          status: "OPEN",
          frequency: c.frequency,
          totalScenarios: c.totalScenarios,
          failingScenarioIds: formatIdList(c.failingScenarioIds),
          regressedScenarioIds: formatIdList(c.regressedScenarioIds),
          suggestedSeverity: c.suggestedSeverity,
          firstSeenAt: c.firstSeenAt,
          lastRunId: c.lastRunId,
          lastRunVersion: c.lastRunVersion,
        },
      })
    )
  }

  for (const u of plan.updates) {
    ops.push(
      db.failureMode.update({
        where: { id: u.id },
        data: {
          status: u.status,
          frequency: u.frequency,
          totalScenarios: u.totalScenarios,
          failingScenarioIds: formatIdList(u.failingScenarioIds),
          regressedScenarioIds: formatIdList(u.regressedScenarioIds),
          suggestedSeverity: u.suggestedSeverity,
          lastRunId: u.lastRunId,
          lastRunVersion: u.lastRunVersion,
          // Only the history fields the plan names are written; absent means leave them alone.
          ...(u.resolvedAt !== undefined ? { resolvedAt: u.resolvedAt } : {}),
          ...(u.reappeared !== undefined ? { reappeared: u.reappeared } : {}),
          ...(u.reappearedAt !== undefined ? { reappearedAt: u.reappearedAt } : {}),
        },
      })
    )
  }

  for (const v of plan.verifications) {
    ops.push(
      db.fix.update({
        where: { id: v.fixId },
        data: { status: "VERIFIED", verifiedAt: v.verifiedAt, verifiedByRunId: v.runId },
      })
    )
    ops.push(
      db.fixEvent.create({
        data: {
          fixId: v.fixId,
          at: v.verifiedAt,
          actorId: null, // the system, not a person
          kind: "VERIFIED",
          fromStatus: "SHIPPED",
          toStatus: "VERIFIED",
          note: `Verified by a ${run.version} run: every scenario of this failure mode passed.`,
        },
      })
    )
  }

  await db.$transaction(ops)

  // Notifications come after the data is safely written, and never throw. Sample fixes
  // are skipped so a fresh install is not filled with invented events.
  for (const v of plan.verifications) {
    if (v.ownerId && !sampleFixIds.has(v.fixId)) {
      await notify(db, [v.ownerId], `Your fix "${v.title}" was verified by a ${run.version} run.`, v.failureModeId)
    }
  }
  const realOwners = new Set(fixRows.filter((f) => !f.isSample && f.ownerId).map((f) => f.ownerId as string))
  for (const r of plan.reappearances) {
    await notify(
      db,
      r.ownerIds.filter((id) => realOwners.has(id)),
      `"${labels[r.theme] ?? r.theme}" has reappeared after it was fixed.`,
      r.failureModeId
    )
  }

  return {
    created: plan.creates.length,
    updated: plan.updates.length,
    verified: plan.verifications.length,
    reappeared: plan.reappearances.length,
  }
}

/** Fail-soft, and uses the client it was given so the seed never opens a second connection. */
async function notify(db: TriageDb, userIds: string[], message: string, failureModeId: string): Promise<void> {
  for (const userId of Array.from(new Set(userIds))) {
    try {
      await db.notification.create({ data: { userId, message, href: `/dashboard/triage/${failureModeId}` } })
    } catch (e) {
      console.error("Failed to create a triage notification", e)
    }
  }
}
