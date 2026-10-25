import type { FailureCategory, Verdict } from "./types"

/** A run passes only if the dev pass rate is at least this. */
export const DEV_PASS_THRESHOLD = 0.85
/** ...and the hold-out pass rate is no more than this far below the dev rate (overfitting check). */
export const MAX_HOLDOUT_GAP = 0.1

const EPSILON = 1e-9

export type Counts = {
  devPassed: number
  devTotal: number
  holdoutPassed: number
  holdoutTotal: number
}

/** Pass rate in the range 0..1, or null when there were no scenarios. */
export function rate(passed: number, total: number): number | null {
  return total > 0 ? passed / total : null
}

export function formatPercent(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`
}

export function computeVerdict(counts: Counts): { verdict: Verdict; reason: string } {
  const devRate = rate(counts.devPassed, counts.devTotal)
  const holdoutRate = rate(counts.holdoutPassed, counts.holdoutTotal)

  if (devRate === null) {
    return { verdict: "FAIL", reason: "No dev scenarios were run, so there is nothing to judge." }
  }

  const thresholdText = formatPercent(DEV_PASS_THRESHOLD)
  if (devRate + EPSILON < DEV_PASS_THRESHOLD) {
    return {
      verdict: "FAIL",
      reason: `Dev pass rate ${formatPercent(devRate)} is below the ${thresholdText} threshold.`,
    }
  }

  if (holdoutRate === null) {
    return {
      verdict: "PASS",
      reason: `Dev pass rate ${formatPercent(devRate)} meets the ${thresholdText} threshold. No hold-out scenarios ran, so overfitting was not checked.`,
    }
  }

  const gap = devRate - holdoutRate
  if (gap > MAX_HOLDOUT_GAP + EPSILON) {
    return {
      verdict: "FAIL",
      reason: `Hold-out pass rate ${formatPercent(holdoutRate)} is ${(gap * 100).toFixed(1)} points below dev (${formatPercent(devRate)}); the limit is ${(MAX_HOLDOUT_GAP * 100).toFixed(0)} points. This suggests overfitting to the dev scenarios.`,
    }
  }

  return {
    verdict: "PASS",
    reason: `Dev pass rate ${formatPercent(devRate)} meets the ${thresholdText} threshold and the hold-out rate ${formatPercent(holdoutRate)} is within ${(MAX_HOLDOUT_GAP * 100).toFixed(0)} points of dev.`,
  }
}

/** Counts of failed results per category, most common first. Passed results are ignored. */
export function summariseFailures(
  results: { passed: boolean; category: string | null }[]
): { category: FailureCategory; count: number }[] {
  const counts = new Map<string, number>()
  for (const r of results) {
    if (r.passed) continue
    const category = r.category ?? "SEVERITY_AND_THERAPY"
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category: category as FailureCategory, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
}

export type RunSummary = Counts & {
  results: { scenarioId: string; passed: boolean }[]
}

export type RunComparison = {
  devDelta: number | null
  holdoutDelta: number | null
  /** Scenario ids that failed in the previous run and pass now. */
  fixed: string[]
  /** Scenario ids that passed in the previous run and fail now. */
  regressed: string[]
}

/**
 * Compares a run with the previous version's run. Scenarios present in only one
 * of the two runs are ignored. Deltas are in rate points (0.1 = 10 points).
 */
export function compareRuns(current: RunSummary, previous: RunSummary): RunComparison {
  const before = new Map(previous.results.map((r) => [r.scenarioId, r.passed]))
  const fixed: string[] = []
  const regressed: string[] = []
  for (const r of current.results) {
    if (!before.has(r.scenarioId)) continue
    const wasPassing = before.get(r.scenarioId)
    if (!wasPassing && r.passed) fixed.push(r.scenarioId)
    if (wasPassing && !r.passed) regressed.push(r.scenarioId)
  }

  const delta = (now: number | null, then: number | null) =>
    now === null || then === null ? null : now - then

  return {
    devDelta: delta(
      rate(current.devPassed, current.devTotal),
      rate(previous.devPassed, previous.devTotal)
    ),
    holdoutDelta: delta(
      rate(current.holdoutPassed, current.holdoutTotal),
      rate(previous.holdoutPassed, previous.holdoutTotal)
    ),
    fixed,
    regressed,
  }
}

/** An LLM-judge score below this fails the scenario (scores run 1 to 5). */
export const JUDGE_PASS_SCORE = 3
