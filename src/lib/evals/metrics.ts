import { latestPerInstance } from "./merge"
import { compareRuns, rate } from "./verdict"

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

/**
 * Loop-time target: a run's verdict should arrive within this long of the change
 * shipping. This is the placeholder from specs/strategy.md ("< 3 days"), which says
 * targets are to be calibrated against a measured baseline, so change it here.
 */
export const LOOP_TIME_TARGET_MS = 3 * DAY_MS

/** The target as people read it: "3 days", not "3.0 days". */
export const LOOP_TIME_TARGET_LABEL = `${LOOP_TIME_TARGET_MS / DAY_MS} days`

/** The fields of an eval run the metrics need. A database row satisfies this. */
export type MetricsRun = {
  specialistId: string
  version: string
  createdAt: Date
  changeShippedAt: Date | null
  startedAt: Date | null
  finishedAt: Date | null
  isSample: boolean
  /** The customer instance the run was made against; runs from before Phase 10 have none. */
  instanceSlug?: string
  devPassed: number
  devTotal: number
  holdoutPassed: number
  holdoutTotal: number
  results: { scenarioId: string; passed: boolean; split?: string }[]
}

/** Specialist versions in release order. */
export type VersionInfo = { version: string }

export type VersionMetrics = {
  version: string
  runCount: number
  /** When the change shipped, from the same run as loopMs (so it always agrees with the loop time shown). */
  shippedAt: Date | null
  /** Release to first verdict. Null when the version has no run with a release time. */
  loopMs: number | null
  /** Release to run started, from the same run as loopMs. */
  waitingMs: number | null
  /** Run started to verdict, from the same run as loopMs. */
  runningMs: number | null
  /** Pass rates from the version's latest run. Null when there are no scenarios in that set. */
  devRate: number | null
  holdoutRate: number | null
  /** Against the previous version's latest run. Null for the first version or when either has no runs. */
  fixed: number | null
  regressed: number | null
}

export type MetricsSummary = {
  versions: VersionMetrics[]
  /** How many versions the loop-time numbers are based on. */
  versionsWithLoop: number
  medianLoopMs: number | null
  /** Loop time of the earliest-released version that has one, and which version that is. */
  baselineMs: number | null
  baselineVersion: string | null
  /** Loop time of the latest-released version that has one, and which version that is. */
  latestMs: number | null
  latestVersion: string | null
  /** True when the median is below the target; null when there is no median. */
  withinTarget: boolean | null
  fixedTotal: number
  regressedTotal: number
  /** Runs left out of loop time because they have no release time or no verdict time. */
  excludedRuns: number
  /** True when any run is illustrative sample data. */
  includesSample: boolean
  /** The instances behind the latest version's pass rates: the worst case across them is shown. */
  instancesConsidered: string[]
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Minutes under an hour, hours under two days, otherwise days to one decimal. Negative values read as zero. */
export function formatDuration(ms: number): string {
  const value = Math.max(0, ms)
  if (value < HOUR_MS) return `${Math.round(value / MINUTE_MS)} min`
  if (value < 2 * DAY_MS) return `${(value / HOUR_MS).toFixed(1)} h`
  return `${(value / DAY_MS).toFixed(1)} days`
}

export function targetStatus(withinTarget: boolean | null): string {
  if (withinTarget === null) return "no data"
  return withinTarget ? "within target" : "above target"
}

const time = (d: Date | null): number => (d ? d.getTime() : Number.NaN)

/** A run counts toward loop time only if it knows when its change shipped and when its verdict arrived. */
function hasLoopTimestamps(run: MetricsRun): boolean {
  return run.changeShippedAt !== null && run.finishedAt !== null
}

/** Durations never go negative: a clock change or a late release date reads as zero, not as a negative time. */
const clamp = (ms: number): number => Math.max(0, ms)

export function loopTimes(run: MetricsRun): {
  loopMs: number | null
  waitingMs: number | null
  runningMs: number | null
} {
  if (!hasLoopTimestamps(run)) return { loopMs: null, waitingMs: null, runningMs: null }
  const shipped = time(run.changeShippedAt)
  const finished = time(run.finishedAt)
  const started = run.startedAt ? time(run.startedAt) : null
  return {
    loopMs: clamp(finished - shipped),
    waitingMs: started === null ? null : clamp(started - shipped),
    runningMs: started === null ? null : clamp(finished - started),
  }
}

const finishTime = (run: MetricsRun): number => time(run.finishedAt ?? run.createdAt)

const instanceOf = (run: MetricsRun): string => run.instanceSlug ?? "standard-clinic"

/**
 * The state of a version across instances: the latest run on each, with a scenario counted
 * as passing only if it passes on all of them. With one instance this is that run itself, so
 * single-instance numbers are exactly what they always were.
 */
export function worstCase(runs: MetricsRun[]): MetricsRun {
  const latest = latestPerInstance(runs.map((r) => ({ run: r, instanceSlug: instanceOf(r), createdAt: new Date(finishTime(r)) }))).map(
    (x) => x.run
  )
  if (latest.length === 1) return latest[0]
  const failing = new Set<string>()
  const splitOf = new Map<string, string | undefined>()
  const seen = new Set<string>()
  for (const run of latest) {
    for (const r of run.results) {
      seen.add(r.scenarioId)
      if (!splitOf.has(r.scenarioId)) splitOf.set(r.scenarioId, r.split)
      if (!r.passed) failing.add(r.scenarioId)
    }
  }
  const results = Array.from(seen)
    .sort()
    .map((scenarioId) => ({ scenarioId, passed: !failing.has(scenarioId), split: splitOf.get(scenarioId) }))
  const count = (split: string, passedOnly: boolean) =>
    results.filter((r) => r.split === split && (!passedOnly || r.passed)).length
  const base = latest.reduce((a, b) => (finishTime(b) >= finishTime(a) ? b : a))
  return {
    ...base,
    results,
    devTotal: count("DEV", false),
    devPassed: count("DEV", true),
    holdoutTotal: count("HOLDOUT", false),
    holdoutPassed: count("HOLDOUT", true),
  }
}

/**
 * Computes every Phase 8 metric from a list of runs and the versions in release order.
 *
 *  - Loop time uses each version's FIRST verdict, so re-running a version later never
 *    inflates it. The headline is the median across versions.
 *  - Pass rates use each version's LATEST run, so they show its current state.
 *  - Scenarios fixed and regressions detected compare each version's latest run with the
 *    previous version's latest run, by scenario id.
 */
export function buildMetrics(runs: MetricsRun[], versions: VersionInfo[]): MetricsSummary {
  const byVersion = new Map<string, MetricsRun[]>()
  for (const run of runs) {
    const list = byVersion.get(run.version) ?? []
    list.push(run)
    byVersion.set(run.version, list)
  }

  const latestRun = (version: string): MetricsRun | null => {
    const list = byVersion.get(version) ?? []
    return list.length === 0 ? null : worstCase(list)
  }

  const instancesOf = (version: string | null): string[] =>
    version === null
      ? []
      : latestPerInstance((byVersion.get(version) ?? []).map((r) => ({ instanceSlug: instanceOf(r), createdAt: new Date(finishTime(r)) }))).map(
          (x) => x.instanceSlug
        )

  const rows: VersionMetrics[] = versions.map((info, index) => {
    const versionRuns = byVersion.get(info.version) ?? []

    const loopCandidates = versionRuns.filter(hasLoopTimestamps)
    const firstVerdict = loopCandidates.length
      ? loopCandidates.reduce((a, b) => (finishTime(b) < finishTime(a) ? b : a))
      : null
    const loop = firstVerdict ? loopTimes(firstVerdict) : { loopMs: null, waitingMs: null, runningMs: null }

    const latest = latestRun(info.version)
    const previous = index > 0 ? latestRun(versions[index - 1].version) : null
    const comparison = latest && previous ? compareRuns(latest, previous) : null

    return {
      version: info.version,
      runCount: versionRuns.length,
      shippedAt: firstVerdict ? firstVerdict.changeShippedAt : null,
      ...loop,
      devRate: latest ? rate(latest.devPassed, latest.devTotal) : null,
      holdoutRate: latest ? rate(latest.holdoutPassed, latest.holdoutTotal) : null,
      fixed: comparison ? comparison.fixed.length : null,
      regressed: comparison ? comparison.regressed.length : null,
    }
  })

  const loopRows = rows.filter((r) => r.loopMs !== null)
  const medianLoopMs = median(loopRows.map((r) => r.loopMs as number))

  return {
    versions: rows,
    versionsWithLoop: loopRows.length,
    medianLoopMs,
    baselineMs: loopRows.length ? (loopRows[0].loopMs as number) : null,
    baselineVersion: loopRows.length ? loopRows[0].version : null,
    latestMs: loopRows.length ? (loopRows[loopRows.length - 1].loopMs as number) : null,
    latestVersion: loopRows.length ? loopRows[loopRows.length - 1].version : null,
    withinTarget: medianLoopMs === null ? null : medianLoopMs < LOOP_TIME_TARGET_MS,
    fixedTotal: rows.reduce((sum, r) => sum + (r.fixed ?? 0), 0),
    regressedTotal: rows.reduce((sum, r) => sum + (r.regressed ?? 0), 0),
    excludedRuns: runs.filter((r) => !hasLoopTimestamps(r)).length,
    includesSample: runs.some((r) => r.isSample),
    instancesConsidered: instancesOf(versions.length ? versions[versions.length - 1].version : null),
  }
}
