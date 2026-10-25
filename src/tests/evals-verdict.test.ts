import { describe, it, expect } from "vitest"
import {
  DEV_PASS_THRESHOLD,
  MAX_HOLDOUT_GAP,
  compareRuns,
  computeVerdict,
  formatPercent,
  judgeCoverage,
  rate,
  summariseFailures,
} from "../lib/evals/verdict"

describe("thresholds", () => {
  it("are the documented values", () => {
    expect(DEV_PASS_THRESHOLD).toBe(0.85)
    expect(MAX_HOLDOUT_GAP).toBe(0.1)
  })
})

describe("rate and formatPercent", () => {
  it("returns null for an empty split", () => {
    expect(rate(0, 0)).toBeNull()
    expect(formatPercent(null)).toBe("n/a")
  })

  it("formats a rate as a percentage", () => {
    expect(formatPercent(rate(22, 24))).toBe("91.7%")
  })
})

describe("computeVerdict", () => {
  const counts = (devPassed: number, devTotal: number, holdoutPassed: number, holdoutTotal: number) => ({
    devPassed,
    devTotal,
    holdoutPassed,
    holdoutTotal,
  })

  it("passes at exactly the dev threshold (17/20 = 85%)", () => {
    expect(computeVerdict(counts(17, 20, 17, 20)).verdict).toBe("PASS")
  })

  it("fails just below the dev threshold (16/19 = 84.2%) and says why", () => {
    const v = computeVerdict(counts(16, 19, 16, 19))
    expect(v.verdict).toBe("FAIL")
    expect(v.reason).toContain("below the 85.0% threshold")
  })

  it("passes when the hold-out gap is exactly the limit (100% vs 90%)", () => {
    expect(computeVerdict(counts(10, 10, 9, 10)).verdict).toBe("PASS")
  })

  it("fails the overfit case: high dev rate, low hold-out rate", () => {
    const v = computeVerdict(counts(24, 24, 6, 8))
    expect(v.verdict).toBe("FAIL")
    expect(v.reason).toContain("overfitting")
    expect(v.reason).toContain("25.0 points")
  })

  it("does not penalise a hold-out rate that is higher than dev", () => {
    expect(computeVerdict(counts(22, 24, 8, 8)).verdict).toBe("PASS")
  })

  it("passes with a note when there are no hold-out scenarios", () => {
    const v = computeVerdict(counts(22, 24, 0, 0))
    expect(v.verdict).toBe("PASS")
    expect(v.reason).toContain("overfitting was not checked")
  })

  it("fails without dividing by zero when there are no dev scenarios", () => {
    const v = computeVerdict(counts(0, 0, 3, 4))
    expect(v.verdict).toBe("FAIL")
    expect(v.reason).toContain("No dev scenarios")
  })

  it("fails a zero pass rate", () => {
    expect(computeVerdict(counts(0, 24, 0, 8)).verdict).toBe("FAIL")
  })
})

describe("summariseFailures", () => {
  it("counts failures by category, most common first, ignoring passes", () => {
    const out = summariseFailures([
      { passed: true, category: null },
      { passed: false, category: "THERAPY" },
      { passed: false, category: "SEVERITY" },
      { passed: false, category: "THERAPY" },
    ])
    expect(out).toEqual([
      { category: "THERAPY", count: 2 },
      { category: "SEVERITY", count: 1 },
    ])
  })

  it("returns an empty list when nothing failed", () => {
    expect(summariseFailures([{ passed: true, category: null }])).toEqual([])
  })

  it("breaks ties alphabetically so the order is stable", () => {
    const out = summariseFailures([
      { passed: false, category: "THERAPY" },
      { passed: false, category: "SEVERITY" },
    ])
    expect(out.map((o) => o.category)).toEqual(["SEVERITY", "THERAPY"])
  })
})

describe("compareRuns", () => {
  const run = (devPassed: number, holdoutPassed: number, results: [string, boolean][]) => ({
    devPassed,
    devTotal: 10,
    holdoutPassed,
    holdoutTotal: 4,
    results: results.map(([scenarioId, passed]) => ({ scenarioId, passed })),
  })

  it("reports deltas, fixed scenarios and regressed scenarios", () => {
    const previous = run(5, 1, [["a", false], ["b", true], ["c", false], ["d", true]])
    const current = run(8, 3, [["a", true], ["b", false], ["c", false], ["d", true]])
    const diff = compareRuns(current, previous)
    expect(diff.devDelta).toBeCloseTo(0.3)
    expect(diff.holdoutDelta).toBeCloseTo(0.5)
    expect(diff.fixed).toEqual(["a"])
    expect(diff.regressed).toEqual(["b"])
  })

  it("reports nothing fixed or regressed when results are identical", () => {
    const r = run(5, 2, [["a", true], ["b", false]])
    expect(compareRuns(r, r)).toMatchObject({ devDelta: 0, holdoutDelta: 0, fixed: [], regressed: [] })
  })

  it("ignores scenarios that exist in only one run", () => {
    const diff = compareRuns(run(5, 1, [["a", true], ["new", false]]), run(5, 1, [["a", true], ["old", true]]))
    expect(diff.fixed).toEqual([])
    expect(diff.regressed).toEqual([])
  })

  it("returns null deltas when a split was empty in either run", () => {
    const empty = { devPassed: 0, devTotal: 0, holdoutPassed: 0, holdoutTotal: 0, results: [] }
    const diff = compareRuns(run(5, 1, []), empty)
    expect(diff.devDelta).toBeNull()
    expect(diff.holdoutDelta).toBeNull()
  })
})

describe("judgeCoverage", () => {
  it("counts scenarios the judge was asked about and those it scored", () => {
    expect(
      judgeCoverage([
        { judgeScore: 5, judgeNote: "ok" },
        { judgeScore: null, judgeNote: "Judge unavailable: boom" },
        { judgeScore: null, judgeNote: null }, // never asked: failed the deterministic checks
      ])
    ).toEqual({ attempted: 2, scored: 1 })
  })

  it("is zero for a run with no judge", () => {
    expect(judgeCoverage([{ judgeScore: null, judgeNote: null }])).toEqual({ attempted: 0, scored: 0 })
    expect(judgeCoverage([])).toEqual({ attempted: 0, scored: 0 })
  })
})
