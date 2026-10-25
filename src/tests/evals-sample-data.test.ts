import { describe, it, expect } from "vitest"
import { SAMPLE_TIMING } from "../lib/evals/sample-data"
import { SPECIALIST_VERSIONS } from "../lib/evals/specialists"
import { formatDuration, buildMetrics, loopTimes, type MetricsRun } from "../lib/evals/metrics"

const asRun = (version: string): MetricsRun => ({
  specialistId: "intake-triage",
  version,
  createdAt: SAMPLE_TIMING[version].finishedAt,
  ...SAMPLE_TIMING[version],
  isSample: true,
  devPassed: 0,
  devTotal: 0,
  holdoutPassed: 0,
  holdoutTotal: 0,
  results: [],
})

describe("sample timeline used by the seed", () => {
  it("has timing for every registered version, so none is left with real timestamps by accident", () => {
    for (const v of SPECIALIST_VERSIONS) expect(SAMPLE_TIMING[v.version]).toBeDefined()
  })

  it("is ordered: shipped, then started, then finished, for every version", () => {
    for (const t of Object.values(SAMPLE_TIMING)) {
      expect(t.changeShippedAt.getTime()).toBeLessThanOrEqual(t.startedAt.getTime())
      expect(t.startedAt.getTime()).toBeLessThanOrEqual(t.finishedAt.getTime())
    }
  })

  it("releases versions in order, with each verdict arriving before the next version ships or after it, never reordering history", () => {
    const [v1, v2] = [SAMPLE_TIMING.v1, SAMPLE_TIMING.v2]
    expect(v1.finishedAt.getTime()).toBeLessThan(v2.finishedAt.getTime())
    expect(v1.changeShippedAt.getTime()).toBeLessThan(v2.changeShippedAt.getTime())
  })

  it("tells the documented story: 21.0 days for v1, 2.0 days for v2, median 11.5 days", () => {
    expect(formatDuration(loopTimes(asRun("v1")).loopMs as number)).toBe("21.0 days")
    expect(formatDuration(loopTimes(asRun("v2")).loopMs as number)).toBe("2.0 days")
    const m = buildMetrics(
      [asRun("v1"), asRun("v2")],
      SPECIALIST_VERSIONS.map((s) => ({ version: s.version }))
    )
    expect(formatDuration(m.medianLoopMs as number)).toBe("11.5 days")
    expect(m.includesSample).toBe(true)
  })
})
