import { DEV_PASS_THRESHOLD, formatPercent } from "./verdict"

/** Pass rates (0 to 1) for one specialist version. Null means the set had no scenarios. */
export type ChartVersion = { version: string; dev: number | null; holdout: number | null }

export type ChartPoint = { version: string; x: number; y: number; value: number }

export type SeriesLabel = { x: number; y: number; placement: "above" | "below" }

/** Layout in SVG user units. The component scales it with viewBox so it fits any width. */
export const CHART = {
  width: 360,
  height: 250,
  left: 40, // room for the y-axis labels
  right: 68, // room for the threshold label, outside the plot so it never touches data
  top: 28, // room for a series label above a point at 100%
  bottom: 46, // room for the version labels
} as const

const LABEL_GAP_ABOVE = 12
const LABEL_GAP_BELOW = 20
const LABEL_STACK = 14

export type ChartGeometry = {
  width: number
  height: number
  plot: { left: number; right: number; top: number; bottom: number }
  yTicks: { value: number; y: number; label: string }[]
  xLabels: { version: string; x: number }[]
  dev: ChartPoint[]
  holdout: ChartPoint[]
  /** SVG path data. Empty when the series has fewer than two connected points. */
  devPath: string
  holdoutPath: string
  threshold: { y: number; label: string }
  labels: { dev: SeriesLabel | null; holdout: SeriesLabel | null }
}

const round = (n: number) => Math.round(n * 10) / 10
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Joins consecutive points with lines; a missing value breaks the line instead of bridging the gap. */
function pathFor(points: (ChartPoint | null)[]): string {
  const parts: string[] = []
  let run: ChartPoint[] = []
  const flush = () => {
    if (run.length >= 2) {
      parts.push(run.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`).join(" "))
    }
    run = []
  }
  for (const p of points) {
    if (p) run.push(p)
    else flush()
  }
  flush()
  return parts.join(" ")
}

/**
 * Turns per-version pass rates into coordinates. Versions are spaced evenly in
 * release order (a category axis, not a time axis), so a later re-run cannot
 * reorder the story. Returns null when there is nothing to draw.
 */
export function buildChart(
  versions: ChartVersion[],
  threshold: number = DEV_PASS_THRESHOLD
): ChartGeometry | null {
  if (versions.length === 0) return null
  if (versions.every((v) => v.dev === null && v.holdout === null)) return null

  const plot = {
    left: CHART.left,
    right: CHART.width - CHART.right,
    top: CHART.top,
    bottom: CHART.height - CHART.bottom,
  }
  const band = (plot.right - plot.left) / versions.length
  const xAt = (i: number) => plot.left + (i + 0.5) * band
  const yAt = (value: number) => plot.bottom - clamp01(value) * (plot.bottom - plot.top)

  const toPoint = (v: ChartVersion, i: number, value: number | null): ChartPoint | null =>
    value === null ? null : { version: v.version, x: xAt(i), y: yAt(value), value }

  const devAll = versions.map((v, i) => toPoint(v, i, v.dev))
  const holdoutAll = versions.map((v, i) => toPoint(v, i, v.holdout))
  const dev = devAll.filter((p): p is ChartPoint => p !== null)
  const holdout = holdoutAll.filter((p): p is ChartPoint => p !== null)

  return {
    width: CHART.width,
    height: CHART.height,
    plot,
    yTicks: [0, 0.25, 0.5, 0.75, 1].map((value) => ({
      value,
      y: yAt(value),
      label: `${Math.round(value * 100)}%`,
    })),
    xLabels: versions.map((v, i) => ({ version: v.version, x: xAt(i) })),
    dev,
    holdout,
    devPath: pathFor(devAll),
    holdoutPath: pathFor(holdoutAll),
    threshold: { y: yAt(threshold), label: `${Math.round(threshold * 100)}% pass` },
    labels: placeSeriesLabels(dev[0] ?? null, holdout[0] ?? null, plot.bottom),
  }
}

/**
 * Names each series once, at its first point, so the lines are identified without
 * relying on colour. The higher point's label goes above and the lower point's below,
 * so they cannot overlap; a label that would fall below the axis flips above (stacked
 * higher if the other label is already there).
 */
function placeSeriesLabels(
  dev: ChartPoint | null,
  holdout: ChartPoint | null,
  plotBottom: number
): { dev: SeriesLabel | null; holdout: SeriesLabel | null } {
  const above = (p: ChartPoint): SeriesLabel => ({
    x: round(p.x),
    y: round(p.y - LABEL_GAP_ABOVE),
    placement: "above",
  })
  const below = (p: ChartPoint): SeriesLabel => ({
    x: round(p.x),
    y: round(p.y + LABEL_GAP_BELOW),
    placement: "below",
  })

  if (dev && !holdout) return { dev: above(dev), holdout: null }
  if (!dev && holdout) return { dev: null, holdout: above(holdout) }
  if (!dev || !holdout) return { dev: null, holdout: null }

  // Same x: the higher marker (smaller y) takes the label above. Different x: dev above, hold-out below.
  const holdoutHigher = dev.x === holdout.x && holdout.y < dev.y
  const upper = holdoutHigher ? holdout : dev
  const lower = holdoutHigher ? dev : holdout

  const upperLabel = above(upper)
  let lowerLabel = below(lower)
  if (lowerLabel.y > plotBottom - 2) {
    // Not enough room under the axis line: put it above too. If it shares an x with the
    // other label, keep it a full line clear of that label, not just of its own marker.
    lowerLabel = above(lower)
    if (lower.x === upper.x) lowerLabel.y = round(Math.min(lowerLabel.y, upperLabel.y - LABEL_STACK))
  }
  return holdoutHigher
    ? { dev: lowerLabel, holdout: upperLabel }
    : { dev: upperLabel, holdout: lowerLabel }
}

/** One sentence per version, for the chart's accessible name. */
export function describeChart(
  versions: ChartVersion[],
  threshold: number = DEV_PASS_THRESHOLD
): string {
  const parts = versions.map(
    (v) => `${v.version}: dev ${formatPercent(v.dev)}, hold-out ${formatPercent(v.holdout)}`
  )
  return `Pass rate by specialist version, in release order. ${parts.join(". ")}. A pass needs a dev rate of at least ${formatPercent(threshold)}.`
}
