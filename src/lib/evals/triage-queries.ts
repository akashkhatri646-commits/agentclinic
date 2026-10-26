import { prisma } from "../prisma"
import { parseIdList } from "./id-list"
import { latestPerInstance, mergeLatestPerInstance } from "./merge"
import { loadSpecialist } from "./specialist-store"
import { instanceNames, listInstances } from "./instances"
import { buildBacklog, currentRun, scenarioRows, toBacklogItem, toFixView, type FixView, type ModeRow } from "./triage-view"

const modeInclude = {
  fixes: { include: { owner: { select: { id: true, email: true } } }, orderBy: { createdAt: "asc" as const } },
}

/** The ranked backlog, the resolved modes, summary counts, and which run they reflect. */
export async function getBacklog(specialistId: string) {
  const [rows, runs, loaded, instances] = await Promise.all([
    prisma.failureMode.findMany({ where: { specialistId }, include: modeInclude }),
    prisma.evalRun.findMany({
      where: { specialistId },
      select: { id: true, version: true, finishedAt: true, createdAt: true, instanceSlug: true },
    }),
    loadSpecialist(prisma, specialistId),
    listInstances(prisma),
  ])
  const labels = Object.fromEntries((loaded?.spec.themes ?? []).map((t) => [t.id, t.label]))
  const backlog = buildBacklog(rows as ModeRow[], runs, (loaded?.versions ?? []).map((v) => v.label), labels)
  // The state is the worst case across instances; say which instances stand behind it.
  const version = backlog.reflects?.version
  const instancesConsidered = version
    ? instanceNames(latestPerInstance(runs.filter((r) => r.version === version)).map((r) => r.instanceSlug), instances)
    : []
  return { ...backlog, instancesConsidered }
}

export type HistoryEntry = {
  id: string
  at: Date
  kind: string
  fromStatus: string | null
  toStatus: string | null
  note: string | null
  /** The person who acted, or null when the system did. */
  actorEmail: string | null
}

export type FixDetail = FixView & { history: HistoryEntry[]; verifiedByVersion: string | null }

/** One failure mode with its score, scenarios, fixes and their history. Null if it does not exist. */
export async function getFailureModeDetail(id: string) {
  const row = await prisma.failureMode.findUnique({
    where: { id },
    include: {
      fixes: {
        include: { owner: { select: { id: true, email: true } }, events: { orderBy: { at: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!row) return null

  const events = row.fixes.flatMap((f) => f.events)
  const actorIds = Array.from(new Set(events.map((e) => e.actorId).filter((a): a is string => !!a)))
  const verifyingRunIds = Array.from(new Set(row.fixes.map((f) => f.verifiedByRunId).filter((r): r is string => !!r)))
  const [actors, verifyingRuns, runs, loaded, instances] = await Promise.all([
    actorIds.length ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } }) : [],
    verifyingRunIds.length
      ? prisma.evalRun.findMany({ where: { id: { in: verifyingRunIds } }, select: { id: true, version: true } })
      : [],
    prisma.evalRun.findMany({
      where: { specialistId: row.specialistId },
      select: { id: true, version: true, finishedAt: true, createdAt: true, instanceSlug: true, results: { select: { scenarioId: true, passed: true } } },
    }),
    loadSpecialist(prisma, row.specialistId),
    listInstances(prisma),
  ])
  const actorEmail = new Map(actors.map((a) => [a.id, a.email]))
  const runVersion = new Map(verifyingRuns.map((r) => [r.id, r.version]))

  const labels = Object.fromEntries((loaded?.spec.themes ?? []).map((t) => [t.id, t.label]))
  const item = toBacklogItem(row as ModeRow, labels)
  const fixes: FixDetail[] = row.fixes.map((f) => ({
    ...toFixView(f as ModeRow["fixes"][number], row),
    verifiedByVersion: f.verifiedByRunId ? runVersion.get(f.verifiedByRunId) ?? null : null,
    history: f.events.map((e) => ({
      id: e.id,
      at: e.at,
      kind: e.kind,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      actorEmail: e.actorId ? actorEmail.get(e.actorId) ?? "a removed user" : null,
    })),
  }))

  const reflected = currentRun(runs, (loaded?.versions ?? []).map((v) => v.label))
  // Which instances fail each scenario, in the version the mode reflects: the latest run on
  // each instance, merged. Names rather than slugs, for display.
  const instanceName = new Map(instances.map((i) => [i.slug, i.name]))
  const reflectedRuns = reflected ? runs.filter((r) => r.version === reflected.version) : []
  const merged = mergeLatestPerInstance(reflectedRuns)
  const failingInstances = Object.fromEntries(
    merged.results.filter((r) => !r.passed).map((r) => [r.scenarioId, r.failingInstances.map((i) => instanceName.get(i) ?? i)])
  )
  const lastRun = row.lastRunId ? runs.find((r) => r.id === row.lastRunId) : undefined
  return {
    specialistId: row.specialistId,
    mode: item,
    label: item.label,
    instancesConsidered: instanceNames(merged.instances, instances),
    lastRunInstance: lastRun ? instanceName.get(lastRun.instanceSlug) ?? lastRun.instanceSlug : null,
    reflects: reflected ? { version: reflected.version, at: reflected.finishedAt ?? reflected.createdAt } : null,
    scenarios: scenarioRows(
      row.theme,
      loaded?.spec.scenarios ?? [],
      parseIdList(row.failingScenarioIds),
      parseIdList(row.regressedScenarioIds),
      row.lastRunId !== null,
      failingInstances
    ),
    fixes,
  }
}

/** Staff and admin users who can own a fix. */
export async function getAssignableOwners() {
  return prisma.user.findMany({
    where: { role: { in: ["STAFF", "ADMIN"] } },
    select: { id: true, email: true, role: true },
    orderBy: { email: "asc" },
  })
}
