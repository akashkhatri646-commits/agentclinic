import { describe, it, expect, vi } from "vitest"
import { getLoopTimeTile } from "../lib/evals/summary"
import { DAY_MS, type MetricsRun } from "../lib/evals/metrics"

// summary.ts imports the real queries module, which would build a database client.
vi.mock("../lib/prisma", () => ({ prisma: {} }))

const d = (iso: string) => new Date(iso)

function run(version: string, overrides: Partial<MetricsRun> = {}): MetricsRun {
  return {
    specialistId: "intake-triage",
    version,
    createdAt: d("2026-10-22T09:04:00Z"),
    changeShippedAt: d("2026-10-20T09:00:00Z"),
    startedAt: d("2026-10-22T09:00:00Z"),
    finishedAt: d("2026-10-22T09:04:00Z"),
    isSample: true,
    devPassed: 22,
    devTotal: 24,
    holdoutPassed: 7,
    holdoutTotal: 8,
    results: [],
    ...overrides,
  }
}

describe("getLoopTimeTile", () => {
  it("returns the headline numbers", async () => {
    const tile = await getLoopTimeTile(async () => [
      run("v1", { changeShippedAt: d("2026-09-01T09:00:00Z"), startedAt: d("2026-09-22T09:00:00Z"), finishedAt: d("2026-09-22T09:05:00Z") }),
      run("v2"),
    ])
    expect(tile).not.toBeNull()
    expect(tile!.versionsWithLoop).toBe(2)
    expect(tile!.withinTarget).toBe(false) // median 11.5 days against a 3 day target
    expect(tile!.latestVersion).toBe("v2")
    expect(tile!.latestMs).toBe(2 * DAY_MS + 4 * 60_000)
    expect(tile!.includesSample).toBe(true)
  })

  it("is within target when every loop is short", async () => {
    const tile = await getLoopTimeTile(async () => [run("v2")])
    expect(tile!.withinTarget).toBe(true)
  })

  it("returns null when there are no runs, so the tile is not shown", async () => {
    expect(await getLoopTimeTile(async () => [])).toBeNull()
  })

  it("returns null when no run has a release time", async () => {
    expect(await getLoopTimeTile(async () => [run("v1", { changeShippedAt: null })])).toBeNull()
  })

  it("does not throw when the metrics cannot be loaded: it logs and returns null", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const load = vi.fn(async () => {
      throw new Error("no such column: changeShippedAt")
    })
    await expect(getLoopTimeTile(load)).resolves.toBeNull()
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
