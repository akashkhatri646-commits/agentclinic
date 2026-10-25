import { prisma } from "../prisma"
import { getScenarios } from "./scenarios/intake-triage"
import { listVersions } from "./specialists"
import { parseIdList } from "./id-list"
import { themeLabel } from "./themes"
import { buildBacklog, currentRun, scenarioRows, toBacklogItem, toFixView, type FixView, type ModeRow } from "./triage-view"

const modeInclude = {
  fixes: { include: { owner: { select: { id: true, email: true } } }, orderBy: { createdAt: "asc" as const } },
}

/** The ranked backlog, the resolved modes, summary counts, and which run they reflect. */
export async function getBacklog(specialistId: string) {
  const [rows, runs] = await Promise.all([
    prisma.failureMode.findMany({ where: { specialistId }, include: modeInclude }),
    prisma.evalRun.findMany({
      where: { specialistId },
      select: { id: true, version: true, finishedAt: true, createdAt: true },
    }),
  ])
  return buildBacklog(rows as ModeRow[], runs, listVersions(specialistId).map((v) => v.version))
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
  const [actors, verifyingRuns, runs] = await Promise.all([
    actorIds.length ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } }) : [],
    verifyingRunIds.length
      ? prisma.evalRun.findMany({ where: { id: { in: verifyingRunIds } }, select: { id: true, version: true } })
      : [],
    prisma.evalRun.findMany({
      where: { specialistId: row.specialistId },
      select: { id: true, version: true, finishedAt: true, createdAt: true },
    }),
  ])
  const actorEmail = new Map(actors.map((a) => [a.id, a.email]))
  const runVersion = new Map(verifyingRuns.map((r) => [r.id, r.version]))

  const item = toBacklogItem(row as ModeRow)
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

  const reflected = currentRun(runs, listVersions(row.specialistId).map((v) => v.version))
  return {
    mode: item,
    label: themeLabel(row.theme),
    reflects: reflected ? { version: reflected.version, at: reflected.finishedAt ?? reflected.createdAt } : null,
    scenarios: scenarioRows(
      row.theme,
      getScenarios(row.specialistId),
      parseIdList(row.failingScenarioIds),
      parseIdList(row.regressedScenarioIds),
      row.lastRunId !== null
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
