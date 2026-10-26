/**
 * Worst case across customer instances. A specialist is tested on several environments, and
 * a scenario only counts as passing if it passes on every environment whose latest run of
 * the version is on record. Pure, so the rule can be tested as a table.
 */
export type InstanceRunInput = {
  instanceSlug: string
  createdAt: Date
  results: { scenarioId: string; passed: boolean }[]
}

export type MergedResult = {
  scenarioId: string
  passed: boolean
  /** The instances whose latest run fails this scenario, sorted. Empty when it passes. */
  failingInstances: string[]
}

export type MergedRuns = {
  results: MergedResult[]
  /** The instances considered, sorted: those with at least one run in the input. */
  instances: string[]
}

/** The latest run on each instance (by creation time; a later entry wins a tie). */
export function latestPerInstance<T extends { instanceSlug: string; createdAt: Date }>(runs: T[]): T[] {
  const latest = new Map<string, T>()
  for (const run of runs) {
    const seen = latest.get(run.instanceSlug)
    if (!seen || run.createdAt.getTime() >= seen.createdAt.getTime()) latest.set(run.instanceSlug, run)
  }
  return Array.from(latest.values()).sort((a, b) => a.instanceSlug.localeCompare(b.instanceSlug))
}

/**
 * Merges the runs of ONE version. Each scenario takes its worst outcome across the latest
 * run of every instance; a scenario missing from some run is judged on the runs that have it.
 * Results come back sorted by scenario id.
 */
export function mergeLatestPerInstance(runs: InstanceRunInput[]): MergedRuns {
  const latest = latestPerInstance(runs)
  const failing = new Map<string, string[]>()
  for (const run of latest) {
    for (const r of run.results) {
      const list = failing.get(r.scenarioId) ?? []
      if (!r.passed) list.push(run.instanceSlug)
      failing.set(r.scenarioId, list)
    }
  }
  return {
    instances: latest.map((r) => r.instanceSlug),
    results: Array.from(failing.entries())
      .map(([scenarioId, failingInstances]) => ({
        scenarioId,
        passed: failingInstances.length === 0,
        failingInstances: failingInstances.sort(),
      }))
      .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId)),
  }
}
