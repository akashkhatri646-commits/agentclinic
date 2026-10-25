import { parseIdList } from "./id-list"
import { themeLabel } from "./themes"
import {
  effectiveSeverity,
  isFixStatus,
  isUnverified,
  priorityScore,
  rankBacklog,
  type FixStatus,
  type Level,
} from "./triage"
import type { Scenario } from "./types"

/** The shapes the pages read, built from database rows by pure functions so they can be tested. */

export type FixRow = {
  id: string
  title: string
  description: string | null
  status: string
  ownerId: string | null
  owner: { id: string; email: string } | null
  shippedVersion: string | null
  shippedAt: Date | null
  verifiedAt: Date | null
  verifiedByRunId: string | null
  isSample: boolean
  createdAt: Date
}

export type ModeRow = {
  id: string
  theme: string
  status: string
  frequency: number
  totalScenarios: number
  failingScenarioIds: string
  regressedScenarioIds: string
  suggestedSeverity: number
  severityOverride: number | null
  effort: number
  lastRunId: string | null
  lastRunVersion: string | null
  firstSeenAt: Date
  resolvedAt: Date | null
  reappeared: boolean
  reappearedAt: Date | null
  fixes: FixRow[]
}

export type RunRef = { id: string; version: string; finishedAt: Date | null; createdAt: Date }

export type FixView = {
  id: string
  title: string
  description: string | null
  status: FixStatus
  ownerId: string | null
  ownerEmail: string | null
  shippedVersion: string | null
  shippedAt: Date | null
  verifiedAt: Date | null
  verifiedByRunId: string | null
  isSample: boolean
  createdAt: Date
  /** Shipped, but the failure mode still fails: not proven yet. */
  unverified: boolean
}

export type BacklogItem = {
  id: string
  theme: string
  label: string
  status: "OPEN" | "RESOLVED"
  frequency: number
  totalScenarios: number
  failingScenarioIds: string[]
  regressedScenarioIds: string[]
  suggestedSeverity: number
  severityOverride: number | null
  severity: Level
  effort: number
  score: number
  reappeared: boolean
  reappearedAt: Date | null
  resolvedAt: Date | null
  fixes: FixView[]
  fixSummary: string
  lastRunVersion: string | null
}

export type Backlog = {
  /** The version and run the backlog reflects: the latest run of the latest evaluated version. */
  reflects: { runId: string; version: string; at: Date } | null
  /** Open failure modes, highest priority first. */
  open: BacklogItem[]
  resolved: BacklogItem[]
  summary: {
    openModes: number
    failingScenarios: number
    /** Fixes that are in progress, or shipped and not yet verified. */
    fixesInFlight: number
    verifiedFixes: number
    /** Open modes that reappeared or have a regressed scenario. */
    flagged: number
  }
  hasSampleFixes: boolean
}

export function toFixView(row: FixRow, mode: { frequency: number }): FixView {
  const status: FixStatus = isFixStatus(row.status) ? row.status : "PROPOSED"
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status,
    ownerId: row.ownerId,
    ownerEmail: row.owner?.email ?? null,
    shippedVersion: row.shippedVersion,
    shippedAt: row.shippedAt,
    verifiedAt: row.verifiedAt,
    verifiedByRunId: row.verifiedByRunId,
    isSample: row.isSample,
    createdAt: row.createdAt,
    unverified: isUnverified({ status }, mode),
  }
}

/** One line about a mode's fixes, in words, for the backlog table. */
export function describeFixes(fixes: FixView[]): string {
  if (fixes.length === 0) return "No fix yet"
  const count = (pred: (f: FixView) => boolean) => fixes.filter(pred).length
  const parts = [
    [count((f) => f.status === "VERIFIED"), "verified"],
    [count((f) => f.unverified), "shipped, not yet verified"],
    [count((f) => f.status === "SHIPPED" && !f.unverified), "shipped"],
    [count((f) => f.status === "IN_PROGRESS"), "in progress"],
    [count((f) => f.status === "PROPOSED"), "proposed"],
  ] as const
  return parts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(", ")
}

/**
 * The run the triage data currently reflects: the latest run of the latest-released
 * version that has been evaluated. A run of an older version never changes the state,
 * so it is not what the backlog shows.
 */
export function currentRun(runs: RunRef[], versionOrder: string[]): RunRef | null {
  const known = runs.filter((r) => versionOrder.includes(r.version))
  if (known.length === 0) return null
  const newest = Math.max(...known.map((r) => versionOrder.indexOf(r.version)))
  const ofNewest = known.filter((r) => versionOrder.indexOf(r.version) === newest)
  const when = (r: RunRef) => (r.finishedAt ?? r.createdAt).getTime()
  return ofNewest.reduce((a, b) => (when(b) >= when(a) ? b : a))
}

export function toBacklogItem(row: ModeRow): BacklogItem {
  const severity = effectiveSeverity(row)
  const fixes = row.fixes
    .map((f) => toFixView(f, row))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  return {
    id: row.id,
    theme: row.theme,
    label: themeLabel(row.theme),
    status: row.status === "RESOLVED" ? "RESOLVED" : "OPEN",
    frequency: row.frequency,
    totalScenarios: row.totalScenarios,
    failingScenarioIds: parseIdList(row.failingScenarioIds),
    regressedScenarioIds: parseIdList(row.regressedScenarioIds),
    suggestedSeverity: row.suggestedSeverity,
    severityOverride: row.severityOverride,
    severity,
    effort: row.effort,
    score: priorityScore({ frequency: row.frequency, severity, effort: row.effort }),
    reappeared: row.reappeared,
    reappearedAt: row.reappearedAt,
    resolvedAt: row.resolvedAt,
    fixes,
    fixSummary: describeFixes(fixes),
    lastRunVersion: row.lastRunVersion,
  }
}

export function buildBacklog(rows: ModeRow[], runs: RunRef[], versionOrder: string[]): Backlog {
  const items = rows.map(toBacklogItem)
  const open = rankBacklog(items)
  const ranked = new Set(open.map((o) => o.id))
  const resolved = items
    .filter((i) => !ranked.has(i.id))
    .sort((a, b) => (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0) || a.label.localeCompare(b.label))
  const allFixes = items.flatMap((i) => i.fixes)
  const run = currentRun(runs, versionOrder)

  return {
    reflects: run ? { runId: run.id, version: run.version, at: run.finishedAt ?? run.createdAt } : null,
    open,
    resolved,
    summary: {
      openModes: open.length,
      failingScenarios: open.reduce((n, m) => n + m.frequency, 0),
      fixesInFlight: allFixes.filter((f) => f.status === "IN_PROGRESS" || f.status === "SHIPPED").length,
      verifiedFixes: allFixes.filter((f) => f.status === "VERIFIED").length,
      flagged: open.filter((m) => m.reappeared || m.regressedScenarioIds.length > 0).length,
    },
    hasSampleFixes: allFixes.some((f) => f.isSample),
  }
}

export type ScenarioRow = {
  id: string
  split: string
  description: string
  expectedSeverity: string
  expectedTherapy: string
  /** Null when the mode has never been evaluated against a run. */
  passing: boolean | null
  regressed: boolean
}

/** The scenarios of a theme with their result in the state the mode reflects. */
export function scenarioRows(
  theme: string,
  scenarios: Scenario[],
  failingIds: string[],
  regressedIds: string[],
  evaluated: boolean
): ScenarioRow[] {
  return scenarios
    .filter((s) => s.theme === theme)
    .map((s) => ({
      id: s.id,
      split: s.split,
      description: s.description,
      expectedSeverity: s.expectedSeverity,
      expectedTherapy: s.expectedTherapy,
      passing: evaluated ? !failingIds.includes(s.id) : null,
      regressed: regressedIds.includes(s.id),
    }))
}
