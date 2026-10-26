import { themeLabel } from "./themes"

/* ───────────────────────── grouping ───────────────────────── */

/** What triage needs to know about a scenario: where it belongs and how much it matters. */
export type TriageScenario = { id: string; theme: string; weight: Level }

export type ThemeGroup = {
  theme: string
  /** Scenarios of this theme in the golden set. */
  total: number
  /** Scenarios of this theme that fail in the run, sorted. */
  failingIds: string[]
  /** The weight (1 to 3) of each failing scenario. */
  failingWeights: Level[]
}

/**
 * Groups a run's results by scenario theme, in the given theme order (default: the order
 * themes first appear in the scenarios). A result for a scenario
 * that is not in the set is ignored, and a scenario with no result is not counted
 * as failing.
 */
export function groupByTheme(
  results: { scenarioId: string; passed: boolean }[],
  scenarios: TriageScenario[],
  themeOrder: string[] = Array.from(new Set(scenarios.map((s) => s.theme)))
): ThemeGroup[] {
  const failed = new Set(results.filter((r) => !r.passed).map((r) => r.scenarioId))
  return themeOrder.map((theme) => {
    const inTheme = scenarios.filter((s) => s.theme === theme)
    const failing = inTheme.filter((s) => failed.has(s.id))
    return {
      theme,
      total: inTheme.length,
      failingIds: failing.map((s) => s.id).sort(),
      failingWeights: failing.map((s) => s.weight),
    }
  }).filter((g) => g.total > 0)
}

/* ───────────────────────── scoring ───────────────────────── */

export type Level = 1 | 2 | 3

export const SEVERITY_LABEL: Record<Level, string> = { 1: "Low", 2: "Medium", 3: "High" }
export const EFFORT_LABEL: Record<Level, string> = { 1: "S", 2: "M", 3: "L" }
export const DEFAULT_EFFORT: Level = 2

export function isLevel(value: unknown): value is Level {
  return value === 1 || value === 2 || value === 3
}

/** The highest weight among the failing scenarios, or 1 when none fail. */
export function suggestSeverity(weights: Level[]): Level {
  return weights.reduce<Level>((max, w) => (w > max ? w : max), 1)
}

/** Staff's override when set, otherwise the suggestion. */
export function effectiveSeverity(mode: {
  suggestedSeverity: number
  severityOverride: number | null
}): Level {
  const value = mode.severityOverride ?? mode.suggestedSeverity
  return isLevel(value) ? value : 1
}

/**
 * Priority = frequency x severity / effort. A bigger job lowers the priority, so
 * effort divides. Severity and effort are clamped to 1..3 so a bad value cannot
 * divide by zero or invert the ranking; frequency below zero counts as zero.
 */
export function priorityScore(input: { frequency: number; severity: number; effort: number }): number {
  const clamp = (n: number) => Math.min(3, Math.max(1, Math.round(n)))
  const frequency = Math.max(0, input.frequency)
  return (frequency * clamp(input.severity)) / clamp(input.effort)
}

export type RankableMode = {
  theme: string
  status: string
  frequency: number
  suggestedSeverity: number
  severityOverride: number | null
  effort: number
}

/**
 * Open failure modes, highest score first. Ties break on severity, then frequency,
 * then label, so the order is stable and explainable. Resolved modes are left out.
 */
export function rankBacklog<T extends RankableMode>(
  modes: T[],
  labels: Record<string, string> = {}
): (T & { score: number; severity: Level })[] {
  return modes
    .filter((m) => m.status === "OPEN")
    .map((m) => {
      const severity = effectiveSeverity(m)
      return { ...m, severity, score: priorityScore({ frequency: m.frequency, severity, effort: m.effort }) }
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.severity - a.severity ||
        b.frequency - a.frequency ||
        (labels[a.theme] ?? themeLabel(a.theme)).localeCompare(labels[b.theme] ?? themeLabel(b.theme))
    )
}

/* ───────────────────────── fix lifecycle ───────────────────────── */

export type FixStatus = "PROPOSED" | "IN_PROGRESS" | "SHIPPED" | "VERIFIED"

export const FIX_STATUSES: FixStatus[] = ["PROPOSED", "IN_PROGRESS", "SHIPPED", "VERIFIED"]

/**
 * Staff move a fix forward one stage at a time and may step back one stage to
 * correct a mistake or a revert. VERIFIED is reachable only through the sync,
 * which needs a run as evidence, so it appears in no list of allowed targets.
 */
const ALLOWED: Record<FixStatus, FixStatus[]> = {
  PROPOSED: ["IN_PROGRESS"],
  IN_PROGRESS: ["PROPOSED", "SHIPPED"],
  SHIPPED: ["IN_PROGRESS"],
  VERIFIED: [],
}

export function nextStatuses(status: FixStatus): FixStatus[] {
  return ALLOWED[status]
}

export function canTransition(from: FixStatus, to: FixStatus): boolean {
  return ALLOWED[from].includes(to)
}

export function isFixStatus(value: unknown): value is FixStatus {
  return typeof value === "string" && (FIX_STATUSES as string[]).includes(value)
}

/** A shipped fix whose failure mode still has failing scenarios has not been proven. */
export function isUnverified(fix: { status: string }, mode: { frequency: number }): boolean {
  return fix.status === "SHIPPED" && mode.frequency > 0
}

/* ───────────────────────── sync planning ───────────────────────── */

export type ModeState = {
  id: string
  theme: string
  status: "OPEN" | "RESOLVED"
  frequency: number
  failingScenarioIds: string[]
  regressedScenarioIds: string[]
  suggestedSeverity: number
  lastRunId: string | null
  lastRunVersion: string | null
}

export type FixState = {
  id: string
  failureModeId: string
  title: string
  status: FixStatus
  shippedVersion: string | null
  ownerId: string | null
}

export type SyncRun = {
  id: string
  version: string
  finishedAt: Date
  results: { scenarioId: string; passed: boolean }[]
}

export type ModeCreate = {
  theme: string
  frequency: number
  totalScenarios: number
  failingScenarioIds: string[]
  regressedScenarioIds: string[]
  suggestedSeverity: number
  firstSeenAt: Date
  lastRunId: string
  lastRunVersion: string
}

export type ModeUpdate = {
  id: string
  theme: string
  status: "OPEN" | "RESOLVED"
  frequency: number
  totalScenarios: number
  failingScenarioIds: string[]
  regressedScenarioIds: string[]
  suggestedSeverity: number
  lastRunId: string
  lastRunVersion: string
  /** A date when the mode resolves, null when it reopens, and absent to leave the stored value alone. */
  resolvedAt?: Date | null
  /** True when a resolved mode fails again, false when it resolves again, absent to leave it alone. */
  reappeared?: boolean
  /** Set when a resolved mode fails again; absent otherwise. */
  reappearedAt?: Date
}

export type FixVerification = {
  fixId: string
  failureModeId: string
  title: string
  ownerId: string | null
  verifiedAt: Date
  runId: string
}

export type Reappearance = {
  failureModeId: string
  theme: string
  /** Owners of the mode's verified fixes, without duplicates or empty values. */
  ownerIds: string[]
}

export type SyncPlan = {
  creates: ModeCreate[]
  updates: ModeUpdate[]
  verifications: FixVerification[]
  reappearances: Reappearance[]
}

export const EMPTY_PLAN: SyncPlan = { creates: [], updates: [], verifications: [], reappearances: [] }

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])

/**
 * Decides what a completed run changes in the triage data. Pure: it reads the stored
 * modes and fixes and the run, and returns the changes, so every rule can be tested
 * without a database.
 *
 * Rules, per theme:
 *  - A run of an older version than the one that last updated a mode never changes
 *    that mode (re-running v1 after v2 must not reopen what v2 fixed).
 *  - Failing scenarios and no mode: create it, open.
 *  - Failing and open: refresh frequency, failing and regressed scenarios, severity.
 *  - Failing and resolved: reopen and mark it reappeared.
 *  - Nothing failing and open: resolve it.
 *  - A shipped fix is verified when this run is of the version it shipped in, or a
 *    later one, and its mode has no failing scenarios in this run.
 *
 * `previousRun` is the latest run of the version released just before this one, used
 * to find scenarios that passed there and fail now. It may be null.
 *
 * Idempotent: planning the same run twice, after applying the first plan, is empty.
 */
export function planSync(input: {
  run: SyncRun
  scenarios: TriageScenario[]
  /** Theme order for the plan; defaults to the order themes appear in the scenarios. */
  themeOrder?: string[]
  modes: ModeState[]
  fixes: FixState[]
  /** Version names in release order. */
  versionOrder: string[]
  previousRun: { results: { scenarioId: string; passed: boolean }[] } | null
}): SyncPlan {
  const { run, scenarios, themeOrder, modes, fixes, versionOrder, previousRun } = input
  const runIndex = versionOrder.indexOf(run.version)
  if (runIndex < 0) return EMPTY_PLAN

  const groups = groupByTheme(run.results, scenarios, themeOrder)
  const previouslyPassing = new Set(
    (previousRun?.results ?? []).filter((r) => r.passed).map((r) => r.scenarioId)
  )

  const plan: SyncPlan = { creates: [], updates: [], verifications: [], reappearances: [] }

  for (const group of groups) {
    const mode = modes.find((m) => m.theme === group.theme)
    const failing = group.failingIds.length > 0
    const regressed = group.failingIds.filter((id) => previouslyPassing.has(id))
    const suggestedSeverity = suggestSeverity(group.failingWeights)

    if (!mode) {
      if (failing) {
        plan.creates.push({
          theme: group.theme,
          frequency: group.failingIds.length,
          totalScenarios: group.total,
          failingScenarioIds: group.failingIds,
          regressedScenarioIds: regressed,
          suggestedSeverity,
          firstSeenAt: run.finishedAt,
          lastRunId: run.id,
          lastRunVersion: run.version,
        })
      }
      continue
    }

    // A run of an older version leaves the mode's state alone.
    const modeIndex = mode.lastRunVersion ? versionOrder.indexOf(mode.lastRunVersion) : -1
    if (modeIndex > runIndex) continue

    const base = {
      id: mode.id,
      theme: mode.theme,
      totalScenarios: group.total,
      lastRunId: run.id,
      lastRunVersion: run.version,
    }

    if (failing && mode.status === "RESOLVED") {
      plan.updates.push({
        ...base,
        status: "OPEN",
        frequency: group.failingIds.length,
        failingScenarioIds: group.failingIds,
        regressedScenarioIds: regressed,
        suggestedSeverity,
        resolvedAt: null,
        reappeared: true,
        reappearedAt: run.finishedAt,
      })
      const ownerIds = Array.from(
        new Set(
          fixes
            .filter((f) => f.failureModeId === mode.id && f.status === "VERIFIED" && f.ownerId)
            .map((f) => f.ownerId as string)
        )
      )
      plan.reappearances.push({ failureModeId: mode.id, theme: mode.theme, ownerIds })
    } else if (failing) {
      const unchanged =
        mode.status === "OPEN" &&
        mode.lastRunId === run.id &&
        mode.frequency === group.failingIds.length &&
        mode.suggestedSeverity === suggestedSeverity &&
        sameList(mode.failingScenarioIds, group.failingIds) &&
        sameList(mode.regressedScenarioIds, regressed)
      if (!unchanged) {
        plan.updates.push({
          ...base,
          status: "OPEN",
          frequency: group.failingIds.length,
          failingScenarioIds: group.failingIds,
          regressedScenarioIds: regressed,
          suggestedSeverity,
        })
      }
    } else if (mode.status === "OPEN") {
      plan.updates.push({
        ...base,
        status: "RESOLVED",
        frequency: 0,
        failingScenarioIds: [],
        regressedScenarioIds: [],
        suggestedSeverity: mode.suggestedSeverity,
        resolvedAt: run.finishedAt,
        reappeared: false,
      })
    } else if (mode.lastRunId !== run.id) {
      // Already resolved and still passing: just note the newer run.
      plan.updates.push({
        ...base,
        status: "RESOLVED",
        frequency: 0,
        failingScenarioIds: [],
        regressedScenarioIds: [],
        suggestedSeverity: mode.suggestedSeverity,
      })
    }
  }

  // Verification does not depend on the "older run" rule: it asks only whether this
  // run is of the shipped version or later, and whether the mode passes in it.
  for (const fix of fixes) {
    if (fix.status !== "SHIPPED" || !fix.shippedVersion) continue
    const shippedIndex = versionOrder.indexOf(fix.shippedVersion)
    if (shippedIndex < 0 || runIndex < shippedIndex) continue
    const mode = modes.find((m) => m.id === fix.failureModeId)
    if (!mode) continue
    const group = groups.find((g) => g.theme === mode.theme)
    if (!group || group.failingIds.length > 0) continue
    plan.verifications.push({
      fixId: fix.id,
      failureModeId: fix.failureModeId,
      title: fix.title,
      ownerId: fix.ownerId,
      verifiedAt: run.finishedAt,
      runId: run.id,
    })
  }

  return plan
}

export function isEmptyPlan(plan: SyncPlan): boolean {
  return (
    plan.creates.length === 0 &&
    plan.updates.length === 0 &&
    plan.verifications.length === 0 &&
    plan.reappearances.length === 0
  )
}
