import { describe, it, expect } from "vitest"
import { CHART, buildChart, describeChart, type ChartVersion } from "../lib/evals/chart"

const plotTop = CHART.top
const plotBottom = CHART.height - CHART.bottom
const plotHeight = plotBottom - plotTop

const two: ChartVersion[] = [
  { version: "v1", dev: 0.5, holdout: 0.375 },
  { version: "v2", dev: 22 / 24, holdout: 0.875 },
]

describe("buildChart: empty input", () => {
  it("returns null for no versions", () => expect(buildChart([])).toBeNull())
  it("returns null when no version has any rate", () => {
    expect(buildChart([{ version: "v1", dev: null, holdout: null }])).toBeNull()
  })
})

describe("buildChart: scaling and order", () => {
  const g = buildChart(two)!

  it("places 0% on the baseline and 100% at the top of the plot", () => {
    const zero = buildChart([{ version: "v1", dev: 0, holdout: 0 }])!
    const full = buildChart([{ version: "v1", dev: 1, holdout: 1 }])!
    expect(zero.dev[0].y).toBe(plotBottom)
    expect(full.dev[0].y).toBe(plotTop)
  })

  it("scales a rate linearly between the two", () => {
    expect(g.dev[0].y).toBeCloseTo(plotBottom - 0.5 * plotHeight)
    expect(g.holdout[0].y).toBeCloseTo(plotBottom - 0.375 * plotHeight)
  })

  it("spaces versions evenly in release order, left to right", () => {
    expect(g.dev.map((p) => p.version)).toEqual(["v1", "v2"])
    expect(g.dev[0].x).toBeLessThan(g.dev[1].x)
    const band = (CHART.width - CHART.right - CHART.left) / 2
    expect(g.dev[1].x - g.dev[0].x).toBeCloseTo(band)
    expect(g.xLabels.map((l) => l.version)).toEqual(["v1", "v2"])
  })

  it("keeps every point inside the plot area, even for out-of-range input", () => {
    const wild = buildChart([{ version: "v1", dev: 1.4, holdout: -0.2 }])!
    expect(wild.dev[0].y).toBe(plotTop)
    expect(wild.holdout[0].y).toBe(plotBottom)
  })

  it("has five y ticks from 0% to 100% with matching labels", () => {
    expect(g.yTicks.map((t) => t.label)).toEqual(["0%", "25%", "50%", "75%", "100%"])
    expect(g.yTicks[0].y).toBe(plotBottom)
    expect(g.yTicks[4].y).toBe(plotTop)
  })

  it("draws the pass threshold at the right height with its label", () => {
    expect(g.threshold.label).toBe("85% pass")
    expect(g.threshold.y).toBeCloseTo(plotBottom - 0.85 * plotHeight)
  })

  it("puts the threshold line between the two v1 rates and the v2 dev rate (the story the chart tells)", () => {
    expect(g.dev[0].y).toBeGreaterThan(g.threshold.y) // v1 below the line (higher y = lower on screen)
    expect(g.dev[1].y).toBeLessThan(g.threshold.y) // v2 above it
  })
})

describe("buildChart: lines", () => {
  it("joins consecutive points with a line", () => {
    const g = buildChart(two)!
    expect(g.devPath).toMatch(/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/)
    expect(g.holdoutPath).toMatch(/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/)
  })

  it("draws no line for a single version, but still has its points", () => {
    const g = buildChart([{ version: "v1", dev: 0.5, holdout: 0.4 }])!
    expect(g.devPath).toBe("")
    expect(g.holdoutPath).toBe("")
    expect(g.dev).toHaveLength(1)
    expect(g.holdout).toHaveLength(1)
  })

  it("breaks the line at a missing value instead of bridging the gap", () => {
    const g = buildChart([
      { version: "v1", dev: 0.5, holdout: null },
      { version: "v2", dev: null, holdout: null },
      { version: "v3", dev: 0.9, holdout: null },
    ])!
    expect(g.dev).toHaveLength(2)
    expect(g.devPath).toBe("") // two points, but not adjacent: no connecting line
    expect(g.holdout).toHaveLength(0)
  })

  it("connects runs on both sides of a gap separately", () => {
    const g = buildChart([
      { version: "v1", dev: 0.2, holdout: 0.1 },
      { version: "v2", dev: 0.4, holdout: 0.2 },
      { version: "v3", dev: null, holdout: null },
      { version: "v4", dev: 0.6, holdout: 0.3 },
      { version: "v5", dev: 0.8, holdout: 0.4 },
    ])!
    expect(g.devPath.match(/M/g)).toHaveLength(2)
  })

  it("handles a series that exists only in the second set", () => {
    const g = buildChart([{ version: "v1", dev: null, holdout: 0.3 }])!
    expect(g.dev).toHaveLength(0)
    expect(g.labels.dev).toBeNull()
    expect(g.labels.holdout).not.toBeNull()
  })
})

describe("buildChart: series labels", () => {
  it("names each series at its first point, dev above and hold-out below when dev is higher", () => {
    const g = buildChart(two)!
    expect(g.labels.dev!.placement).toBe("above")
    expect(g.labels.holdout!.placement).toBe("below")
    expect(g.labels.dev!.x).toBeCloseTo(g.dev[0].x, 0)
    expect(g.labels.dev!.y).toBeLessThan(g.dev[0].y)
    expect(g.labels.holdout!.y).toBeGreaterThan(g.holdout[0].y)
  })

  it("swaps placement when hold-out starts higher, so the labels still cannot overlap", () => {
    const g = buildChart([{ version: "v1", dev: 0.4, holdout: 0.7 }])!
    expect(g.labels.holdout!.placement).toBe("above")
    expect(g.labels.dev!.placement).toBe("below")
  })

  it("keeps a label above a point at 100% inside the drawing area", () => {
    const g = buildChart([{ version: "v1", dev: 1, holdout: 0.5 }])!
    expect(g.labels.dev!.y).toBeGreaterThan(8) // text above the baseline y stays visible
  })

  it("flips a below-label above, and stacks it clear of the other label, when there is no room under the axis", () => {
    const g = buildChart([{ version: "v1", dev: 0.02, holdout: 0 }])!
    expect(g.labels.dev!.placement).toBe("above")
    expect(g.labels.holdout!.placement).toBe("above")
    expect(Math.abs(g.labels.dev!.y - g.labels.holdout!.y)).toBeGreaterThanOrEqual(14)
  })
})

describe("describeChart", () => {
  it("summarises every version and the pass rule for the accessible name", () => {
    const text = describeChart(two)
    expect(text).toContain("v1: dev 50.0%, hold-out 37.5%")
    expect(text).toContain("v2: dev 91.7%, hold-out 87.5%")
    expect(text).toContain("at least 85.0%")
  })

  it("says n/a for a missing rate", () => {
    expect(describeChart([{ version: "v1", dev: null, holdout: 0.5 }])).toContain("dev n/a, hold-out 50.0%")
  })
})
