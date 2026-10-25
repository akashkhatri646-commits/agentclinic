import { getRunsForMetrics } from "./queries"
import { buildMetrics, type MetricsRun } from "./metrics"
import { INTAKE_TRIAGE_ID, listVersions } from "./specialists"

export type LoopTimeTile = {
  medianLoopMs: number
  withinTarget: boolean
  latestMs: number | null
  latestVersion: string | null
  versionsWithLoop: number
  includesSample: boolean
}

/**
 * The numbers for the staff-dashboard tile. Fail-soft: this sits on a page that
 * has nothing to do with evals, so if the metrics cannot be loaded it logs and
 * returns null (the tile is simply not shown) instead of taking the dashboard
 * down. Also null when there is no loop time to show yet.
 */
export async function getLoopTimeTile(
  load: (specialistId: string) => Promise<MetricsRun[]> = getRunsForMetrics
): Promise<LoopTimeTile | null> {
  try {
    const runs = await load(INTAKE_TRIAGE_ID)
    const metrics = buildMetrics(
      runs,
      listVersions(INTAKE_TRIAGE_ID).map((v) => ({ version: v.version }))
    )
    if (metrics.medianLoopMs === null || metrics.withinTarget === null) return null
    return {
      medianLoopMs: metrics.medianLoopMs,
      withinTarget: metrics.withinTarget,
      latestMs: metrics.latestMs,
      latestVersion: metrics.latestVersion,
      versionsWithLoop: metrics.versionsWithLoop,
      includesSample: metrics.includesSample,
    }
  } catch (e) {
    console.error("Failed to load loop-time metrics for the dashboard", e)
    return null
  }
}
