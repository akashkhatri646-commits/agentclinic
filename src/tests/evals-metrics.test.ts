import { describe, it, expect } from "vitest"
import {
  DAY_MS,
  LOOP_TIME_TARGET_LABEL,
  LOOP_TIME_TARGET_MS,
  buildMetrics,
  formatDuration,
  loopTimes,
  median,
  targetStatus,
  type MetricsRun,
  type VersionInfo,
} from "../lib/evals/metrics"

const d = (iso: string) => new Date(iso)

const versions: VersionInfo[] = [{ version: "v1" }, { version: "v2" }]

function makeRun(overrides: Partial<MetricsRun> = {}): MetricsRun {
  return {
    specialistId: "intake-triage",
    version: "v1",
    createdAt: d("2026-09-22T09:05:00Z"),
    changeShippedAt: d("2026-09-01T09:00:00Z"),
    startedAt: d("2026-09-22T09:00:00Z"),
    finishedAt: d("2026-09-22T09:05:00Z"),
    isSample: false,
    devPassed: 12,
    devTotal: 24,
    holdoutPassed: 3,
    holdoutTotal: 8,
    results: [],
    ...overrides,
  }
}

describe("median", () => {
  it("returns null for no values", () => expect(median([])).toBeNull())
  it("returns the only value", () => expect(median([7])).toBe(7))
  it("returns the middle of an odd count, regardless of order", () => expect(median([9, 1, 5])).toBe(5))
  it("returns the mean of the two middle values for an even count", () => expect(median([1, 2, 3, 10])).toBe(2.5))
  it("does not change the input", () => {
    const input = [3, 1, 2]
    median(input)
    expect(input).toEqual([3, 1, 2])
  })
})

describe("formatDuration", () => {
  it.each([
    [0, "0 min"],
    [29_000, "0 min"],
    [31_000, "1 min"],
    [59 * 60_000, "59 min"],
    [60 * 60_000, "1.0 h"],
    [5.5 * 3_600_000, "5.5 h"],
    [47.9 * 3_600_000, "47.9 h"],
    [2 * DAY_MS, "2.0 days"],
    [21 * DAY_MS, "21.0 days"],
    [11.5 * DAY_MS, "11.5 days"],
  ])("formats %s ms as %s", (ms, expected) => expect(formatDuration(ms)).toBe(expected))

  it("reads a negative duration as zero", () => expect(formatDuration(-5 * DAY_MS)).toBe("0 min"))
})

describe("targetStatus", () => {
  it("uses words, not just colour", () => {
    expect(targetStatus(true)).toBe("within target")
    expect(targetStatus(false)).toBe("above target")
    expect(targetStatus(null)).toBe("no data")
  })
})

describe("loopTimes", () => {
  it("splits loop time into waiting and running", () => {
    expect(loopTimes(makeRun())).toEqual({
      loopMs: 21 * DAY_MS + 5 * 60_000,
      waitingMs: 21 * DAY_MS,
      runningMs: 5 * 60_000,
    })
  })

  it("is empty when the release time or verdict time is missing", () => {
    const empty = { loopMs: null, waitingMs: null, runningMs: null }
    expect(loopTimes(makeRun({ changeShippedAt: null }))).toEqual(empty)
    expect(loopTimes(makeRun({ finishedAt: null }))).toEqual(empty)
  })

  it("clamps negative durations to zero", () => {
    // Shipped after the verdict (clock change, or a release date set too late).
    const r = loopTimes(makeRun({ changeShippedAt: d("2026-10-01T00:00:00Z") }))
    expect(r.loopMs).toBe(0)
    expect(r.waitingMs).toBe(0)
  })

  it("leaves the stage split empty when there is no start time, but still gives the loop time", () => {
    const r = loopTimes(makeRun({ startedAt: null }))
    expect(r.loopMs).toBe(21 * DAY_MS + 5 * 60_000)
    expect(r.waitingMs).toBeNull()
    expect(r.runningMs).toBeNull()
  })
})

describe("buildMetrics: loop time", () => {
  it("uses the first verdict of each version, so a later re-run does not change it", () => {
    const first = makeRun()
    const rerun = makeRun({
      createdAt: d("2026-12-01T00:00:00Z"),
      startedAt: d("2026-12-01T00:00:00Z"),
      finishedAt: d("2026-12-01T00:01:00Z"),
    })
    const before = buildMetrics([first], versions).versions[0].loopMs
    const after = buildMetrics([first, rerun], versions).versions[0].loopMs
    expect(after).toBe(before)
    expect(buildMetrics([rerun, first], versions).versions[0].loopMs).toBe(before) // input order does not matter
  })

  it("shows the ship time of the run the loop time came from, so the two always agree", () => {
    const first = makeRun()
    const rerun = makeRun({
      changeShippedAt: d("2026-11-15T00:00:00Z"), // a later run with its own, different ship time
      createdAt: d("2026-12-01T00:00:00Z"),
      startedAt: d("2026-12-01T00:00:00Z"),
      finishedAt: d("2026-12-01T00:01:00Z"),
    })
    const row = buildMetrics([rerun, first], versions).versions[0]
    expect(row.shippedAt).toEqual(first.changeShippedAt)
    expect(row.loopMs).toBe(21 * DAY_MS + 5 * 60_000)
  })

  it("has no ship time for a version whose runs were all excluded", () => {
    expect(buildMetrics([makeRun({ changeShippedAt: null })], versions).versions[0].shippedAt).toBeNull()
  })

  it("takes the median across versions", () => {
    const m = buildMetrics(
      [
        makeRun(),
        makeRun({
          version: "v2",
          changeShippedAt: d("2026-10-20T09:00:00Z"),
          startedAt: d("2026-10-22T09:00:00Z"),
          finishedAt: d("2026-10-22T09:04:00Z"),
        }),
      ],
      versions
    )
    expect(m.versionsWithLoop).toBe(2)
    expect(m.baselineMs).toBe(21 * DAY_MS + 5 * 60_000)
    expect(m.baselineVersion).toBe("v1")
    expect(m.latestMs).toBe(2 * DAY_MS + 4 * 60_000)
    expect(m.latestVersion).toBe("v2")
    expect(m.medianLoopMs).toBe((21 * DAY_MS + 5 * 60_000 + 2 * DAY_MS + 4 * 60_000) / 2)
  })

  it("with a single version, baseline, latest and median are the same", () => {
    const m = buildMetrics([makeRun()], versions)
    expect(m.baselineVersion).toBe("v1")
    expect(m.latestVersion).toBe("v1")
    expect(m.baselineMs).toBe(m.latestMs)
    expect(m.medianLoopMs).toBe(m.baselineMs)
  })

  it("excludes runs with no release time or no verdict time, and counts them", () => {
    const m = buildMetrics(
      [makeRun({ changeShippedAt: null }), makeRun({ finishedAt: null }), makeRun()],
      versions
    )
    expect(m.excludedRuns).toBe(2)
    expect(m.versions[0].loopMs).toBe(21 * DAY_MS + 5 * 60_000)
  })

  it("gives no loop time to a version whose only runs are excluded", () => {
    const m = buildMetrics([makeRun({ changeShippedAt: null })], versions)
    expect(m.versions[0].loopMs).toBeNull()
    expect(m.medianLoopMs).toBeNull()
    expect(m.withinTarget).toBeNull()
  })

  it("lists versions that have never been run, with empty metrics, and skips them for baseline and latest", () => {
    const m = buildMetrics([makeRun({ version: "v2", changeShippedAt: d("2026-10-20T09:00:00Z") })], versions)
    expect(m.versions[0]).toMatchObject({ version: "v1", runCount: 0, loopMs: null, shippedAt: null, devRate: null })
    expect(m.baselineMs).toBe(m.latestMs)
    expect(m.baselineVersion).toBe("v2")
  })

  it("returns an empty, valid summary with no runs", () => {
    const m = buildMetrics([], versions)
    expect(m.versions).toHaveLength(2)
    expect(m).toMatchObject({
      versionsWithLoop: 0,
      medianLoopMs: null,
      baselineMs: null,
      baselineVersion: null,
      latestMs: null,
      latestVersion: null,
      withinTarget: null,
      fixedTotal: 0,
      regressedTotal: 0,
      excludedRuns: 0,
      includesSample: false,
    })
  })
})

describe("buildMetrics: target", () => {
  const withMedian = (ms: number) =>
    buildMetrics([makeRun({ changeShippedAt: d("2026-09-01T00:00:00Z"), finishedAt: new Date(d("2026-09-01T00:00:00Z").getTime() + ms), startedAt: null })], versions)

  it("is the 3 day placeholder from the strategy doc", () => expect(LOOP_TIME_TARGET_MS).toBe(3 * DAY_MS))
  it("reads as \"3 days\", not \"3.0 days\"", () => expect(LOOP_TIME_TARGET_LABEL).toBe("3 days"))
  it("is within target just under 3 days", () => expect(withMedian(LOOP_TIME_TARGET_MS - 1).withinTarget).toBe(true))
  it("is not within target at exactly 3 days (the target is 'under 3 days')", () =>
    expect(withMedian(LOOP_TIME_TARGET_MS).withinTarget).toBe(false))
  it("is above target just over 3 days", () => expect(withMedian(LOOP_TIME_TARGET_MS + 1).withinTarget).toBe(false))
})

describe("buildMetrics: pass rates, fixed and regressed", () => {
  const v1Run = makeRun({
    devPassed: 12,
    devTotal: 24,
    holdoutPassed: 3,
    holdoutTotal: 8,
    results: [
      { scenarioId: "a", passed: false },
      { scenarioId: "b", passed: true },
      { scenarioId: "c", passed: false },
      { scenarioId: "d", passed: true },
    ],
  })
  const v2Run = makeRun({
    version: "v2",
    changeShippedAt: d("2026-10-20T09:00:00Z"),
    startedAt: d("2026-10-22T09:00:00Z"),
    finishedAt: d("2026-10-22T09:04:00Z"),
    devPassed: 22,
    devTotal: 24,
    holdoutPassed: 7,
    holdoutTotal: 8,
    results: [
      { scenarioId: "a", passed: true },
      { scenarioId: "b", passed: false },
      { scenarioId: "c", passed: true },
      { scenarioId: "d", passed: true },
    ],
  })

  it("takes pass rates from each version's latest run", () => {
    const m = buildMetrics([v1Run, v2Run], versions)
    expect(m.versions[0].devRate).toBeCloseTo(0.5)
    expect(m.versions[0].holdoutRate).toBeCloseTo(0.375)
    expect(m.versions[1].devRate).toBeCloseTo(22 / 24)
    expect(m.versions[1].holdoutRate).toBeCloseTo(0.875)
  })

  it("changes pass rates, but not loop time, when a version is re-run", () => {
    const rerun = makeRun({
      createdAt: d("2026-12-01T00:00:00Z"),
      startedAt: d("2026-12-01T00:00:00Z"),
      finishedAt: d("2026-12-01T00:01:00Z"),
      devPassed: 20,
      devTotal: 24,
      holdoutPassed: 6,
      holdoutTotal: 8,
      results: v1Run.results,
    })
    const m = buildMetrics([v1Run, rerun], versions)
    expect(m.versions[0].devRate).toBeCloseTo(20 / 24)
    expect(m.versions[0].loopMs).toBe(21 * DAY_MS + 5 * 60_000)
  })

  it("picks the latest run by verdict time, not by position in the list", () => {
    const newer = makeRun({ finishedAt: d("2026-12-01T00:00:00Z"), createdAt: d("2026-12-01T00:00:00Z"), devPassed: 24 })
    expect(buildMetrics([newer, v1Run], versions).versions[0].devRate).toBeCloseTo(1)
    expect(buildMetrics([v1Run, newer], versions).versions[0].devRate).toBeCloseTo(1)
  })

  it("counts scenarios fixed and regressions detected against the previous version", () => {
    const m = buildMetrics([v1Run, v2Run], versions)
    expect(m.versions[1].fixed).toBe(2) // a and c now pass
    expect(m.versions[1].regressed).toBe(1) // b now fails
    expect(m.fixedTotal).toBe(2)
    expect(m.regressedTotal).toBe(1)
  })

  it("gives the first version no comparison", () => {
    const m = buildMetrics([v1Run, v2Run], versions)
    expect(m.versions[0].fixed).toBeNull()
    expect(m.versions[0].regressed).toBeNull()
  })

  it("gives no comparison when the previous version has never been run", () => {
    const m = buildMetrics([v2Run], versions)
    expect(m.versions[1].fixed).toBeNull()
    expect(m.fixedTotal).toBe(0)
  })

  it("shows an empty hold-out set as no rate, not zero", () => {
    const m = buildMetrics([makeRun({ holdoutPassed: 0, holdoutTotal: 0 })], versions)
    expect(m.versions[0].holdoutRate).toBeNull()
  })
})

describe("buildMetrics: sample data", () => {
  it("reports when any run is sample data", () => {
    expect(buildMetrics([makeRun({ isSample: true })], versions).includesSample).toBe(true)
    expect(buildMetrics([makeRun(), makeRun({ isSample: true })], versions).includesSample).toBe(true)
  })

  it("reports no sample data when every run is real", () => {
    expect(buildMetrics([makeRun()], versions).includesSample).toBe(false)
  })
})

describe("the seeded story, computed by hand", () => {
  // v1: shipped 1 Sep 09:00, started 22 Sep 09:00, verdict 22 Sep 09:05 -> 21 days 5 min
  // v2: shipped 20 Oct 09:00, started 22 Oct 09:00, verdict 22 Oct 09:04 ->  2 days 4 min
  const m = buildMetrics(
    [
      makeRun({ isSample: true }),
      makeRun({
        version: "v2",
        isSample: true,
        changeShippedAt: d("2026-10-20T09:00:00Z"),
        startedAt: d("2026-10-22T09:00:00Z"),
        finishedAt: d("2026-10-22T09:04:00Z"),
      }),
    ],
    versions
  )

  it("reads 21.0 days, 2.0 days and a median of 11.5 days", () => {
    expect(formatDuration(m.versions[0].loopMs as number)).toBe("21.0 days")
    expect(formatDuration(m.versions[1].loopMs as number)).toBe("2.0 days")
    expect(formatDuration(m.medianLoopMs as number)).toBe("11.5 days")
  })

  it("is above the 3 day target overall while the latest version is within it", () => {
    expect(m.withinTarget).toBe(false)
    expect(targetStatus(m.withinTarget)).toBe("above target")
    expect(m.latestMs as number).toBeLessThan(LOOP_TIME_TARGET_MS)
  })

  it("splits v1's loop into 21.0 days waiting and 5 minutes running", () => {
    expect(formatDuration(m.versions[0].waitingMs as number)).toBe("21.0 days")
    expect(formatDuration(m.versions[0].runningMs as number)).toBe("5 min")
  })
})
