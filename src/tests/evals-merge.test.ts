import { describe, it, expect } from "vitest"
import { latestPerInstance, mergeLatestPerInstance, type InstanceRunInput } from "../lib/evals/merge"
import { instanceNames } from "../lib/evals/instances"
import { worstCase, buildMetrics, type MetricsRun } from "../lib/evals/metrics"
import { pickSpecialist, withSpecialist } from "../lib/evals/picker"
import { describeCategory } from "../lib/evals/format"
import { canCreateSpecialist, canImportOutputs, canManageSpecialist, canViewSpecialists } from "../lib/guards"
import { rankBacklog } from "../lib/evals/triage"

const at = (iso: string) => new Date(iso)
const run = (instanceSlug: string, iso: string, failing: string[], all = ["a", "b", "c"]): InstanceRunInput => ({
  instanceSlug,
  createdAt: at(iso),
  results: all.map((scenarioId) => ({ scenarioId, passed: !failing.includes(scenarioId) })),
})

describe("mergeLatestPerInstance", () => {
  it("is the run itself for one instance", () => {
    const m = mergeLatestPerInstance([run("x", "2026-10-01T00:00:00Z", ["b"])])
    expect(m.instances).toEqual(["x"])
    expect(m.results).toEqual([
      { scenarioId: "a", passed: true, failingInstances: [] },
      { scenarioId: "b", passed: false, failingInstances: ["x"] },
      { scenarioId: "c", passed: true, failingInstances: [] },
    ])
  })

  it("fails a scenario that fails on any instance, naming which", () => {
    const m = mergeLatestPerInstance([run("x", "2026-10-01T00:00:00Z", ["a"]), run("y", "2026-10-01T00:00:00Z", ["b"]), run("z", "2026-10-01T00:00:00Z", [])])
    expect(m.results.map((r) => [r.scenarioId, r.passed, r.failingInstances])).toEqual([
      ["a", false, ["x"]],
      ["b", false, ["y"]],
      ["c", true, []],
    ])
    expect(m.instances).toEqual(["x", "y", "z"])
  })

  it("lists every instance that fails the same scenario, sorted", () => {
    const m = mergeLatestPerInstance([run("z", "2026-10-01T00:00:00Z", ["a"]), run("x", "2026-10-01T00:00:00Z", ["a"])])
    expect(m.results[0].failingInstances).toEqual(["x", "z"])
  })

  it("uses only the latest run on each instance", () => {
    const m = mergeLatestPerInstance([run("x", "2026-10-01T00:00:00Z", ["a", "b"]), run("x", "2026-10-02T00:00:00Z", [])])
    expect(m.results.every((r) => r.passed)).toBe(true)
  })

  it("lets a later entry win a tie on time", () => {
    const first = run("x", "2026-10-01T00:00:00Z", ["a"])
    const second = run("x", "2026-10-01T00:00:00Z", [])
    expect(mergeLatestPerInstance([first, second]).results.every((r) => r.passed)).toBe(true)
  })

  it("judges a scenario that only some runs include on the runs that have it", () => {
    const m = mergeLatestPerInstance([run("x", "2026-10-01T00:00:00Z", [], ["a", "b"]), run("y", "2026-10-01T00:00:00Z", ["c"], ["a", "c"])])
    expect(m.results.map((r) => [r.scenarioId, r.passed])).toEqual([["a", true], ["b", true], ["c", false]])
  })

  it("returns nothing for no runs", () => {
    expect(mergeLatestPerInstance([])).toEqual({ results: [], instances: [] })
  })

  it("does not change its input", () => {
    const runs = [run("y", "2026-10-02T00:00:00Z", ["a"]), run("x", "2026-10-01T00:00:00Z", [])]
    const copy = JSON.stringify(runs)
    mergeLatestPerInstance(runs)
    expect(JSON.stringify(runs)).toBe(copy)
  })
})

describe("latestPerInstance", () => {
  it("returns one run per instance, sorted by instance", () => {
    const l = latestPerInstance([run("b", "2026-10-01T00:00:00Z", []), run("a", "2026-10-01T00:00:00Z", []), run("b", "2026-10-03T00:00:00Z", ["a"])])
    expect(l.map((r) => [r.instanceSlug, r.createdAt.toISOString().slice(0, 10)])).toEqual([["a", "2026-10-01"], ["b", "2026-10-03"]])
  })
})

describe("metrics across instances", () => {
  const mrun = (instanceSlug: string | undefined, fail: string[], over: Partial<MetricsRun> = {}): MetricsRun => {
    const ids = ["d1", "d2", "d3", "d4", "h1", "h2"]
    const results = ids.map((scenarioId) => ({ scenarioId, passed: !fail.includes(scenarioId), split: scenarioId.startsWith("d") ? "DEV" : "HOLDOUT" }))
    return {
      specialistId: "s", version: "v1", instanceSlug, createdAt: at("2026-10-02T00:00:00Z"),
      changeShippedAt: at("2026-10-01T00:00:00Z"), startedAt: at("2026-10-01T12:00:00Z"), finishedAt: at("2026-10-02T00:00:00Z"),
      isSample: false, devTotal: 4, devPassed: 4 - fail.filter((f) => f.startsWith("d")).length,
      holdoutTotal: 2, holdoutPassed: 2 - fail.filter((f) => f.startsWith("h")).length, results, ...over,
    }
  }

  it("leaves a single run (or runs without an instance) exactly as it was", () => {
    const only = mrun("x", ["d1"])
    expect(worstCase([only])).toBe(only)
    const old = mrun(undefined, ["d1"])
    expect(worstCase([old])).toBe(old)
  })

  it("takes the worst case across the latest run on each instance, counting by split", () => {
    const merged = worstCase([mrun("x", ["d1"]), mrun("y", ["d2", "h1"])])
    expect([merged.devPassed, merged.devTotal, merged.holdoutPassed, merged.holdoutTotal]).toEqual([2, 4, 1, 2])
  })

  it("reports pass rates as the worst case and says which instances were considered", () => {
    const m = buildMetrics([mrun("x", ["d1"]), mrun("y", ["d2", "h1"])], [{ version: "v1" }])
    expect(m.versions[0].devRate).toBe(0.5)
    expect(m.versions[0].holdoutRate).toBe(0.5)
    expect(m.instancesConsidered).toEqual(["x", "y"])
  })

  it("keeps loop time from the first verdict, whichever instance it was on", () => {
    const early = mrun("x", [], { finishedAt: at("2026-10-02T00:00:00Z"), createdAt: at("2026-10-02T00:00:00Z") })
    const late = mrun("y", [], { finishedAt: at("2026-10-09T00:00:00Z"), createdAt: at("2026-10-09T00:00:00Z") })
    expect(buildMetrics([late, early], [{ version: "v1" }]).versions[0].loopMs).toBe(24 * 3600 * 1000)
  })
})

describe("specialist picker", () => {
  const list = [{ slug: "a" }, { slug: "b" }]
  it("selects the requested specialist, or the first for an unknown or missing request", () => {
    expect(pickSpecialist(list, "b")?.slug).toBe("b")
    for (const q of [undefined, "", "nope", "__proto__", "A"]) expect(pickSpecialist(list, q)?.slug).toBe("a")
  })
  it("returns null when there are no specialists", () => expect(pickSpecialist([], "a")).toBeNull())
  it("adds the choice to links, respecting an existing query", () => {
    expect(withSpecialist("/dashboard/evals", "a b")).toBe("/dashboard/evals?specialist=a%20b")
    expect(withSpecialist("/dashboard/evals?error=x", "a")).toBe("/dashboard/evals?error=x&specialist=a")
    expect(withSpecialist("/dashboard/evals", null)).toBe("/dashboard/evals")
  })
})

describe("describeCategory", () => {
  it.each([
    ["MISMATCH:severity", "severity did not match"],
    ["MISMATCH:severity+EMPTY:rationale", "severity did not match, rationale was empty"],
    ["NOT_IN_REFERENCE:therapy", "therapy was not in the environment's list"],
    ["NOT_ALLOWED:level", "level was not an allowed value"],
    ["JUDGE:rationale", "rationale was scored too low by the judge"],
    ["SOMETHING_ELSE", "something else"],
    [null, "unknown"],
  ])("describes %j", (category, expected) => expect(describeCategory(category)).toBe(expected))
})

describe("specialist permissions", () => {
  it("lets staff and admin view and create, and nobody else", () => {
    for (const role of ["STAFF", "ADMIN"]) {
      expect(canViewSpecialists(role)).toBe(true)
      expect(canCreateSpecialist(role)).toBe(true)
    }
    for (const role of ["AGENT", "", "staff", "SUPERUSER"]) {
      expect(canViewSpecialists(role)).toBe(false)
      expect(canCreateSpecialist(role)).toBe(false)
    }
  })

  it("lets an admin manage any specialist, and staff only their own", () => {
    expect(canManageSpecialist("ADMIN", "u1", "u2")).toBe(true)
    expect(canManageSpecialist("ADMIN", "u1", null)).toBe(true)
    expect(canManageSpecialist("STAFF", "u1", "u1")).toBe(true)
    expect(canManageSpecialist("STAFF", "u1", "u2")).toBe(false)
    expect(canManageSpecialist("STAFF", "u1", null)).toBe(false)
    expect(canManageSpecialist("STAFF", "", "")).toBe(false)
  })

  it("never lets an agent or an unknown role manage a specialist, even their own", () => {
    for (const role of ["AGENT", "", "staff", "OWNER"]) expect(canManageSpecialist(role, "u1", "u1")).toBe(false)
  })

  it("applies the same rule to importing outputs", () => {
    expect(canImportOutputs("STAFF", "u1", "u1")).toBe(true)
    expect(canImportOutputs("STAFF", "u1", "u2")).toBe(false)
  })
})

describe("rankBacklog labels", () => {
  const mode = (theme: string) => ({ theme, status: "OPEN", frequency: 1, suggestedSeverity: 1, severityOverride: null, effort: 1 })
  it("breaks ties by the label given, falling back to the built-in label or the id", () => {
    const ranked = rankBacklog([mode("zz"), mode("aa")], { zz: "Alpha", aa: "Omega" })
    expect(ranked.map((m) => m.theme)).toEqual(["zz", "aa"])
    expect(rankBacklog([mode("zz"), mode("aa")]).map((m) => m.theme)).toEqual(["aa", "zz"])
  })
})

describe("instanceNames", () => {
  const instances = [
    { slug: "standard-clinic", name: "Standard clinic" },
    { slug: "short-staffed-clinic", name: "Short-staffed clinic" },
    { slug: "regional-catalogue", name: "Regional catalogue" },
  ]
  it("lists names in the instances' own order, standard first, whatever order the slugs come in", () => {
    expect(instanceNames(["short-staffed-clinic", "standard-clinic"], instances)).toEqual(["Standard clinic", "Short-staffed clinic"])
    expect(instanceNames(["regional-catalogue", "short-staffed-clinic", "standard-clinic"], instances)).toEqual([
      "Standard clinic", "Short-staffed clinic", "Regional catalogue",
    ])
  })
  it("keeps the slug text for an unknown instance and puts it last, without repeating", () => {
    expect(instanceNames(["zeta", "alpha", "standard-clinic", "alpha"], instances)).toEqual(["Standard clinic", "alpha", "zeta"])
  })
  it("returns nothing for no slugs", () => expect(instanceNames([], instances)).toEqual([]))
})
