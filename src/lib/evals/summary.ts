import { getRunsForMetrics } from "./queries"
import { buildMetrics, type MetricsRun } from "./metrics"
import { listSpecialists } from "./specialist-store"

export type LoopTimeTile = {
  medianLoopMs: number
  withinTarget: boolean
  latestMs: number | null
  latestVersion: string | null
  versionsWithLoop: number
  includesSample: boolean
}

async function defaultSpecialist(): Promise<{ slug: string; versions: string[] } | null> {
  const { prisma } = await import("../prisma")
  const [first] = await listSpecialists(prisma)
  if (!first) return null
  const labels = await (await import("./queries")).getVersionLabels(first.slug)
  return { slug: first.slug, versions: labels }
}

/**
 * The numbers for the staff-dashboard tile. Fail-soft: this sits on a page that
 * has nothing to do with evals, so if the metrics cannot be loaded it logs and
 * returns null (the tile is simply not shown) instead of taking the dashboard
 * down. Also null when there is no loop time to show yet.
 */
export async function getLoopTimeTile(
  load: (specialistId: string) => Promise<MetricsRun[]> = getRunsForMetrics,
  /** The default specialist (the first created) and its versions in release order. */
  loadDefault: () => Promise<{ slug: string; versions: string[] } | null> = defaultSpecialist
): Promise<LoopTimeTile | null> {
  try {
    const specialist = await loadDefault()
    if (!specialist) return null
    const runs = await load(specialist.slug)
    const metrics = buildMetrics(runs, specialist.versions.map((version) => ({ version })))
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
