import { describe, it, expect } from "vitest"
import { INTAKE_TRIAGE_SCENARIOS as scenarios } from "../lib/evals/scenarios/intake-triage"
import {
  DEFAULT_EFFORT,
  EMPTY_PLAN,
  FIX_STATUSES,
  canTransition,
  effectiveSeverity,
  groupByTheme,
  isEmptyPlan,
  isFixStatus,
  isLevel,
  isUnverified,
  nextStatuses,
  planSync,
  priorityScore,
  rankBacklog,
  suggestSeverity,
  type FixState,
  type FixStatus,
  type ModeState,
  type SyncPlan,
  type SyncRun,
} from "../lib/evals/triage"
import { formatIdList, parseIdList } from "../lib/evals/id-list"

const order = ["v1", "v2", "v3"]
const at = (iso: string) => new Date(iso)

const V1_FAIL = [
  "d05", "d06", "d07", "d11", "d12", "d13", "d16", "d17", "d19", "d21", "d22", "d23", "h01", "h02", "h04", "h05", "h08",
]
const V2_FAIL = ["d23", "d24", "h08"]

const results = (failIds: string[]) => scenarios.map((s) => ({ scenarioId: s.id, passed: !failIds.includes(s.id) }))
const makeRun = (version: string, failIds: string[], finishedAt = "2026-10-22T09:04:00Z"): SyncRun => ({
  id: `run-${version}-${finishedAt}`,
  version,
  finishedAt: at(finishedAt),
  results: results(failIds),
})

function plan(args: {
  run: SyncRun
  modes?: ModeState[]
  fixes?: FixState[]
  previousFail?: string[] | null
}): SyncPlan {
  return planSync({
    run: args.run,
    scenarios,
    modes: args.modes ?? [],
    fixes: args.fixes ?? [],
    versionOrder: order,
    previousRun: args.previousFail ? { results: results(args.previousFail) } : null,
  })
}

let nextId = 1
const mode = (over: Partial<ModeState> = {}): ModeState => ({
  id: `m${nextId++}`,
  theme: "expectation-gap",
  status: "OPEN",
  frequency: 1,
  failingScenarioIds: ["d11"],
  regressedScenarioIds: [],
  suggestedSeverity: 3,
  lastRunId: "old-run",
  lastRunVersion: "v1",
  ...over,
})

const fix = (over: Partial<FixState> = {}): FixState => ({
  id: `f${nextId++}`,
  failureModeId: "m-x",
  title: "A fix",
  status: "SHIPPED",
  shippedVersion: "v2",
  ownerId: "owner-1",
  ...over,
})

/** A minimal stand-in for applying a plan to stored state, to test idempotency. */
function apply(modes: ModeState[], fixes: FixState[], p: SyncPlan, run: SyncRun) {
  const nextModes = modes.map((m) => {
    const u = p.updates.find((x) => x.id === m.id)
    return u
      ? {
          ...m,
          status: u.status,
          frequency: u.frequency,
          failingScenarioIds: u.failingScenarioIds,
          regressedScenarioIds: u.regressedScenarioIds,
          suggestedSeverity: u.suggestedSeverity,
          lastRunId: u.lastRunId,
          lastRunVersion: u.lastRunVersion,
        }
      : m
  })
  for (const c of p.creates) {
    nextModes.push({
      id: `new-${c.theme}`,
      theme: c.theme,
      status: "OPEN",
      frequency: c.frequency,
      failingScenarioIds: c.failingScenarioIds,
      regressedScenarioIds: c.regressedScenarioIds,
      suggestedSeverity: c.suggestedSeverity,
      lastRunId: c.lastRunId,
      lastRunVersion: c.lastRunVersion,
    })
  }
  const nextFixes = fixes.map((f) =>
    p.verifications.some((v) => v.fixId === f.id) ? { ...f, status: "VERIFIED" as FixStatus } : f
  )
  void run
  return { modes: nextModes, fixes: nextFixes }
}

describe("groupByTheme", () => {
  it("reports every theme with no failing scenarios when everything passes", () => {
    const groups = groupByTheme(results([]), scenarios)
    expect(groups).toHaveLength(10)
    expect(groups.every((g) => g.failingIds.length === 0 && g.total > 0)).toBe(true)
  })

  it("groups failing scenarios by theme with their ids sorted", () => {
    const groups = groupByTheme(results(["d12", "d11", "d23"]), scenarios)
    const by = (theme: string) => groups.find((g) => g.theme === theme)!
    expect(by("expectation-gap").failingIds).toEqual(["d11", "d12"])
    expect(by("expectation-gap").total).toBe(5)
    expect(by("sarcasm-and-idiom").failingIds).toEqual(["d23"])
    expect(by("negation").failingIds).toEqual([])
  })

  it("carries the expected severity of each failing scenario", () => {
    const g = groupByTheme(results(["d23", "d24"]), scenarios).find((x) => x.theme === "sarcasm-and-idiom")!
    expect(g.failingSeverities.sort()).toEqual(["LOW", "MEDIUM"])
  })

  it("matches the shipped results: v1 fails 17 scenarios across 8 themes, v2 fails 3 across 2", () => {
    const failing = (ids: string[]) => groupByTheme(results(ids), scenarios).filter((g) => g.failingIds.length > 0)
    const v1 = failing(V1_FAIL)
    expect(v1).toHaveLength(8)
    expect(v1.reduce((n, g) => n + g.failingIds.length, 0)).toBe(17)
    const v2 = failing(V2_FAIL)
    expect(v2.map((g) => g.theme).sort()).toEqual(["frequency-vs-intensity", "sarcasm-and-idiom"])
  })

  it("ignores results for scenarios that are not in the set, and does not count a missing result as failing", () => {
    const groups = groupByTheme([{ scenarioId: "zzz", passed: false }], scenarios)
    expect(groups.every((g) => g.failingIds.length === 0)).toBe(true)
  })

  it("lists themes in the registry order", () => {
    const groups = groupByTheme(results([]), scenarios)
    expect(groups[0].theme).toBe("token-anxiety")
  })
})

describe("severity", () => {
  it("suggests the highest expected severity among failing scenarios", () => {
    expect(suggestSeverity(["LOW", "HIGH", "MEDIUM"])).toBe(3)
    expect(suggestSeverity(["LOW", "MEDIUM"])).toBe(2)
    expect(suggestSeverity(["LOW"])).toBe(1)
  })

  it("suggests 1 when nothing fails", () => expect(suggestSeverity([])).toBe(1))

  it("uses the staff override when set, and the suggestion when cleared", () => {
    expect(effectiveSeverity({ suggestedSeverity: 2, severityOverride: 3 })).toBe(3)
    expect(effectiveSeverity({ suggestedSeverity: 2, severityOverride: null })).toBe(2)
  })

  it("treats a stored value outside 1 to 3 as 1 instead of propagating it", () => {
    expect(effectiveSeverity({ suggestedSeverity: 7, severityOverride: null })).toBe(1)
  })

  it("recognises valid levels only", () => {
    expect([1, 2, 3].every(isLevel)).toBe(true)
    expect([0, 4, 1.5, "2", null, undefined].some(isLevel)).toBe(false)
  })
})

describe("priorityScore (frequency x severity / effort)", () => {
  it("is zero with no failing scenarios", () => {
    expect(priorityScore({ frequency: 0, severity: 3, effort: 1 })).toBe(0)
  })

  it.each([
    [5, 3, 1, 15],
    [5, 3, 2, 7.5],
    [5, 3, 3, 5],
    [2, 2, 2, 2],
    [1, 2, 2, 1],
  ])("frequency %s, severity %s, effort %s gives %s", (frequency, severity, effort, expected) => {
    expect(priorityScore({ frequency, severity, effort })).toBeCloseTo(expected)
  })

  it("a bigger job lowers the priority: effort divides", () => {
    const small = priorityScore({ frequency: 3, severity: 2, effort: 1 })
    const large = priorityScore({ frequency: 3, severity: 2, effort: 3 })
    expect(large).toBeLessThan(small)
  })

  it("cannot divide by zero or invert the ranking on a bad value", () => {
    expect(Number.isFinite(priorityScore({ frequency: 2, severity: 2, effort: 0 }))).toBe(true)
    expect(priorityScore({ frequency: 2, severity: 2, effort: 0 })).toBe(priorityScore({ frequency: 2, severity: 2, effort: 1 }))
    expect(priorityScore({ frequency: 2, severity: 2, effort: 99 })).toBe(priorityScore({ frequency: 2, severity: 2, effort: 3 }))
    expect(priorityScore({ frequency: -4, severity: 2, effort: 2 })).toBe(0)
    expect(priorityScore({ frequency: 2, severity: 0, effort: 2 })).toBe(priorityScore({ frequency: 2, severity: 1, effort: 2 }))
  })

  it("defaults effort to M", () => expect(DEFAULT_EFFORT).toBe(2))
})

describe("rankBacklog", () => {
  const base = { suggestedSeverity: 2, severityOverride: null, effort: 2 }

  it("leaves out resolved modes", () => {
    const ranked = rankBacklog([
      { theme: "negation", status: "RESOLVED", frequency: 0, ...base },
      { theme: "softening-words", status: "OPEN", frequency: 1, ...base },
    ])
    expect(ranked.map((m) => m.theme)).toEqual(["softening-words"])
  })

  it("orders by score, highest first, and reports the score and severity used", () => {
    const ranked = rankBacklog([
      { theme: "negation", status: "OPEN", frequency: 1, ...base },
      { theme: "expectation-gap", status: "OPEN", frequency: 5, ...base },
    ])
    expect(ranked.map((m) => m.theme)).toEqual(["expectation-gap", "negation"])
    expect(ranked[0].score).toBeCloseTo(5)
    expect(ranked[0].severity).toBe(2)
  })

  it("breaks ties on severity, then frequency, then label", () => {
    const ranked = rankBacklog([
      { theme: "softening-words", status: "OPEN", frequency: 2, suggestedSeverity: 2, severityOverride: null, effort: 2 }, // 2
      { theme: "negation", status: "OPEN", frequency: 1, suggestedSeverity: 3, severityOverride: null, effort: 3 }, // 1 (not tied)
      { theme: "token-anxiety", status: "OPEN", frequency: 4, suggestedSeverity: 1, severityOverride: null, effort: 2 }, // 2
      { theme: "ambiguous-prompts", status: "OPEN", frequency: 1, suggestedSeverity: 2, severityOverride: null, effort: 1 }, // 2
    ])
    // Three modes score 2: severity 2 beats 1; of the two with severity 2, frequency 2 beats 1.
    expect(ranked.map((m) => m.theme)).toEqual(["softening-words", "ambiguous-prompts", "token-anxiety", "negation"])
  })

  it("falls back to the label so equal modes keep a stable order", () => {
    const same = { status: "OPEN", frequency: 1, suggestedSeverity: 2, severityOverride: null, effort: 2 }
    const a = rankBacklog([{ theme: "token-anxiety", ...same }, { theme: "negation", ...same }])
    const b = rankBacklog([{ theme: "negation", ...same }, { theme: "token-anxiety", ...same }])
    expect(a.map((m) => m.theme)).toEqual(b.map((m) => m.theme))
    expect(a[0].theme).toBe("negation") // "Negated wording" sorts before "Token and budget worries"
  })

  it("lets an override change the order", () => {
    const modes = [
      { theme: "negation", status: "OPEN", frequency: 1, suggestedSeverity: 1, severityOverride: 3, effort: 2 },
      { theme: "softening-words", status: "OPEN", frequency: 1, suggestedSeverity: 2, severityOverride: null, effort: 2 },
    ]
    expect(rankBacklog(modes)[0].theme).toBe("negation")
  })

  it("does not change its input", () => {
    const modes = [
      { theme: "negation", status: "OPEN", frequency: 1, ...base },
      { theme: "softening-words", status: "OPEN", frequency: 3, ...base },
    ]
    const copy = JSON.stringify(modes)
    rankBacklog(modes)
    expect(JSON.stringify(modes)).toBe(copy)
  })
})

describe("fix transitions", () => {
  const allowed: [FixStatus, FixStatus][] = [
    ["PROPOSED", "IN_PROGRESS"],
    ["IN_PROGRESS", "PROPOSED"],
    ["IN_PROGRESS", "SHIPPED"],
    ["SHIPPED", "IN_PROGRESS"],
  ]

  it("allows exactly the documented moves and no others", () => {
    for (const from of FIX_STATUSES) {
      for (const to of FIX_STATUSES) {
        const expected = allowed.some(([a, b]) => a === from && b === to)
        expect(canTransition(from, to), `${from} to ${to}`).toBe(expected)
      }
    }
  })

  it("never lets staff reach VERIFIED, from any status", () => {
    for (const from of FIX_STATUSES) expect(canTransition(from, "VERIFIED")).toBe(false)
    for (const from of FIX_STATUSES) expect(nextStatuses(from)).not.toContain("VERIFIED")
  })

  it("lets nothing leave VERIFIED", () => expect(nextStatuses("VERIFIED")).toEqual([]))

  it("does not allow staying in the same status", () => {
    for (const s of FIX_STATUSES) expect(canTransition(s, s)).toBe(false)
  })

  it("recognises valid statuses only", () => {
    expect(FIX_STATUSES.every(isFixStatus)).toBe(true)
    expect(["done", "", null, 3].some(isFixStatus)).toBe(false)
  })

  it("flags a shipped fix whose failure mode still fails as unverified", () => {
    expect(isUnverified({ status: "SHIPPED" }, { frequency: 2 })).toBe(true)
    expect(isUnverified({ status: "SHIPPED" }, { frequency: 0 })).toBe(false)
    expect(isUnverified({ status: "IN_PROGRESS" }, { frequency: 2 })).toBe(false)
    expect(isUnverified({ status: "VERIFIED" }, { frequency: 2 })).toBe(false)
  })
})

describe("planSync: creating and updating failure modes", () => {
  it("does nothing for a version it does not know", () => {
    expect(plan({ run: makeRun("v9", V1_FAIL) })).toEqual(EMPTY_PLAN)
  })

  it("creates one open mode per failing theme from the v1 run", () => {
    const p = plan({ run: makeRun("v1", V1_FAIL, "2026-09-22T09:05:00Z") })
    expect(p.creates).toHaveLength(8)
    const eg = p.creates.find((c) => c.theme === "expectation-gap")!
    expect(eg).toMatchObject({
      frequency: 5,
      totalScenarios: 5,
      suggestedSeverity: 3,
      lastRunVersion: "v1",
      regressedScenarioIds: [],
    })
    expect(eg.failingScenarioIds).toEqual(["d11", "d12", "d13", "d22", "h04"])
    expect(eg.firstSeenAt).toEqual(at("2026-09-22T09:05:00Z"))
    expect(p.updates).toEqual([])
  })

  it("does not create a mode for a theme with nothing failing", () => {
    expect(plan({ run: makeRun("v1", []) })).toEqual(EMPTY_PLAN)
  })

  it("finds regressed scenarios: failing now, passing in the previous version", () => {
    const p = plan({ run: makeRun("v2", V2_FAIL), previousFail: V1_FAIL })
    const sarcasm = p.creates.find((c) => c.theme === "sarcasm-and-idiom")!
    expect(sarcasm.failingScenarioIds).toEqual(["d23", "d24"])
    expect(sarcasm.regressedScenarioIds).toEqual(["d24"]) // d24 passed in v1; d23 failed in both
    expect(p.creates.find((c) => c.theme === "frequency-vs-intensity")!.regressedScenarioIds).toEqual([])
  })

  it("reports no regressions without a previous run", () => {
    const p = plan({ run: makeRun("v2", V2_FAIL), previousFail: null })
    expect(p.creates.every((c) => c.regressedScenarioIds.length === 0)).toBe(true)
  })

  it("refreshes an open mode that is still failing", () => {
    const m = mode({ theme: "expectation-gap", frequency: 5, failingScenarioIds: ["d11", "d12", "d13", "d22", "h04"] })
    const p = plan({ run: makeRun("v1", ["d11", "d12"], "2026-09-23T00:00:00Z"), modes: [m] })
    expect(p.updates).toHaveLength(1)
    expect(p.updates[0]).toMatchObject({ id: m.id, status: "OPEN", frequency: 2 })
    // An open mode that is merely refreshed must not have its history fields touched.
    expect(p.updates[0].resolvedAt).toBeUndefined()
    expect(p.updates[0].reappeared).toBeUndefined()
    expect(p.updates[0].reappearedAt).toBeUndefined()
    expect(p.reappearances).toEqual([])
  })

  it("resolves an open mode when nothing in it fails any more", () => {
    const m = mode({ theme: "expectation-gap" })
    const p = plan({ run: makeRun("v2", V2_FAIL, "2026-10-22T09:04:00Z"), modes: [m] })
    const u = p.updates.find((x) => x.id === m.id)!
    expect(u).toMatchObject({ status: "RESOLVED", frequency: 0, failingScenarioIds: [], regressedScenarioIds: [], reappeared: false })
    expect(u.resolvedAt).toEqual(at("2026-10-22T09:04:00Z"))
    expect(u.lastRunVersion).toBe("v2")
  })

  it("reopens a resolved mode that fails again, marks it reappeared, and names the owners of its verified fixes", () => {
    const m = mode({ theme: "expectation-gap", status: "RESOLVED", frequency: 0, lastRunVersion: "v2" })
    const fixes = [
      fix({ failureModeId: m.id, status: "VERIFIED", ownerId: "alice" }),
      fix({ failureModeId: m.id, status: "VERIFIED", ownerId: "alice" }), // same owner twice
      fix({ failureModeId: m.id, status: "VERIFIED", ownerId: null }),
      fix({ failureModeId: m.id, status: "IN_PROGRESS", ownerId: "bob" }), // not verified: not told
      fix({ failureModeId: "other-mode", status: "VERIFIED", ownerId: "carol" }), // another mode
    ]
    const p = plan({ run: makeRun("v2", ["d11", "d12"], "2026-10-30T10:00:00Z"), modes: [m], fixes })
    const u = p.updates.find((x) => x.id === m.id)!
    expect(u).toMatchObject({ status: "OPEN", frequency: 2, resolvedAt: null, reappeared: true })
    expect(u.reappearedAt).toEqual(at("2026-10-30T10:00:00Z"))
    expect(p.reappearances).toEqual([{ failureModeId: m.id, theme: "expectation-gap", ownerIds: ["alice"] }])
  })

  it("only notes a newer run on a resolved mode that is still passing", () => {
    const m = mode({ theme: "expectation-gap", status: "RESOLVED", frequency: 0, lastRunId: "run-a", lastRunVersion: "v2" })
    const p = plan({ run: makeRun("v3", []), modes: [m] })
    expect(p.updates).toHaveLength(1)
    expect(p.updates[0]).toMatchObject({ status: "RESOLVED", lastRunVersion: "v3" })
    // It was resolved earlier; noting a newer run must not erase when, or the flag state.
    expect(p.updates[0].resolvedAt).toBeUndefined()
    expect(p.updates[0].reappeared).toBeUndefined()
    expect(p.updates[0].reappearedAt).toBeUndefined()
    expect(p.reappearances).toEqual([])
  })
})

describe("planSync: which runs may change a mode's state", () => {
  it("ignores a run of an older version: re-running v1 after v2 must not reopen what v2 fixed", () => {
    const m = mode({ theme: "expectation-gap", status: "RESOLVED", frequency: 0, lastRunVersion: "v2" })
    const p = plan({ run: makeRun("v1", V1_FAIL), modes: [m] })
    expect(p.updates.find((u) => u.id === m.id)).toBeUndefined()
    expect(p.reappearances).toEqual([])
  })

  it("ignores an older version's results for an open mode too", () => {
    const m = mode({ theme: "sarcasm-and-idiom", frequency: 2, failingScenarioIds: ["d23", "d24"], lastRunVersion: "v2" })
    const p = plan({ run: makeRun("v1", ["d23"]), modes: [m] })
    expect(p.updates.find((u) => u.id === m.id)).toBeUndefined()
  })

  it("lets a re-run of the same version update the mode", () => {
    const m = mode({ theme: "sarcasm-and-idiom", frequency: 2, failingScenarioIds: ["d23", "d24"], lastRunId: "first", lastRunVersion: "v2" })
    const p = plan({ run: makeRun("v2", ["d23"]), modes: [m] })
    expect(p.updates.find((u) => u.id === m.id)).toMatchObject({ frequency: 1, failingScenarioIds: ["d23"] })
  })

  it("lets a newer version update the mode", () => {
    const m = mode({ theme: "sarcasm-and-idiom", frequency: 2, failingScenarioIds: ["d23", "d24"], lastRunVersion: "v2" })
    const p = plan({ run: makeRun("v3", []), modes: [m] })
    expect(p.updates.find((u) => u.id === m.id)).toMatchObject({ status: "RESOLVED", lastRunVersion: "v3" })
  })

  it("treats a mode with no recorded version as updatable by any run", () => {
    const m = mode({ theme: "sarcasm-and-idiom", frequency: 2, failingScenarioIds: ["d23", "d24"], lastRunVersion: null })
    expect(plan({ run: makeRun("v1", ["d23"]), modes: [m] }).updates).toHaveLength(1)
  })
})

describe("planSync: verifying fixes", () => {
  const resolvedMode = () => mode({ theme: "expectation-gap" })

  it("verifies a shipped fix when a run of its version passes every scenario of its mode", () => {
    const m = resolvedMode()
    const f = fix({ failureModeId: m.id, shippedVersion: "v2", ownerId: "alice", title: "Add expectation rules" })
    const p = plan({ run: makeRun("v2", V2_FAIL, "2026-10-22T09:04:00Z"), modes: [m], fixes: [f] })
    expect(p.verifications).toEqual([
      {
        fixId: f.id,
        failureModeId: m.id,
        title: "Add expectation rules",
        ownerId: "alice",
        verifiedAt: at("2026-10-22T09:04:00Z"),
        runId: expect.any(String),
      },
    ])
  })

  it("uses the run's finish time, not the wall clock", () => {
    const m = resolvedMode()
    const p = plan({ run: makeRun("v2", [], "2020-01-01T00:00:00Z"), modes: [m], fixes: [fix({ failureModeId: m.id })] })
    expect(p.verifications[0].verifiedAt).toEqual(at("2020-01-01T00:00:00Z"))
  })

  it("verifies on a later version as well", () => {
    const m = resolvedMode()
    const p = plan({ run: makeRun("v3", []), modes: [m], fixes: [fix({ failureModeId: m.id, shippedVersion: "v2" })] })
    expect(p.verifications).toHaveLength(1)
  })

  it("does not verify on a run of an older version than the fix shipped in", () => {
    const m = resolvedMode()
    const p = plan({ run: makeRun("v1", []), modes: [m], fixes: [fix({ failureModeId: m.id, shippedVersion: "v2" })] })
    expect(p.verifications).toEqual([])
  })

  it("leaves a shipped fix alone while the mode's scenarios still fail", () => {
    const m = mode({ theme: "sarcasm-and-idiom", frequency: 2, failingScenarioIds: ["d23", "d24"] })
    const p = plan({ run: makeRun("v2", V2_FAIL), modes: [m], fixes: [fix({ failureModeId: m.id })] })
    expect(p.verifications).toEqual([])
  })

  it.each<[string, Partial<FixState>]>([
    ["proposed", { status: "PROPOSED" }],
    ["in progress", { status: "IN_PROGRESS" }],
    ["already verified", { status: "VERIFIED" }],
    ["shipped with no version recorded", { shippedVersion: null }],
    ["shipped in an unknown version", { shippedVersion: "v9" }],
  ])("does not verify a fix that is %s", (_name, over) => {
    const m = resolvedMode()
    const p = plan({ run: makeRun("v2", []), modes: [m], fixes: [fix({ failureModeId: m.id, ...over })] })
    expect(p.verifications).toEqual([])
  })

  it("verifies every shipped fix of the same mode together", () => {
    const m = resolvedMode()
    const p = plan({
      run: makeRun("v2", []),
      modes: [m],
      fixes: [fix({ failureModeId: m.id }), fix({ failureModeId: m.id, ownerId: null })],
    })
    expect(p.verifications).toHaveLength(2)
  })

  it("verifies against the run even when the mode's state is not updated (an older-version run of the shipped version)", () => {
    const m = mode({ theme: "expectation-gap", status: "RESOLVED", frequency: 0, lastRunVersion: "v2" })
    const p = plan({ run: makeRun("v1", []), modes: [m], fixes: [fix({ failureModeId: m.id, shippedVersion: "v1" })] })
    expect(p.updates.find((u) => u.id === m.id)).toBeUndefined()
    expect(p.verifications).toHaveLength(1)
  })

  it("ignores a fix whose mode is not in the stored state", () => {
    const p = plan({ run: makeRun("v2", []), modes: [], fixes: [fix({ failureModeId: "gone" })] })
    expect(p.verifications).toEqual([])
  })
})

describe("planSync: idempotency", () => {
  it("planning the same run again, after applying the plan, changes nothing", () => {
    const run = makeRun("v2", V2_FAIL, "2026-10-22T09:04:00Z")
    const modes = [mode({ theme: "expectation-gap" }), mode({ theme: "sarcasm-and-idiom", frequency: 1, failingScenarioIds: ["d23"] })]
    const fixes = [fix({ failureModeId: modes[0].id })]

    const first = plan({ run, modes, fixes, previousFail: V1_FAIL })
    expect(isEmptyPlan(first)).toBe(false)

    const after = apply(modes, fixes, first, run)
    const second = plan({ run, modes: after.modes, fixes: after.fixes, previousFail: V1_FAIL })
    expect(isEmptyPlan(second)).toBe(true)
  })

  it("is empty when a fresh run creates nothing and changes nothing", () => {
    expect(isEmptyPlan(EMPTY_PLAN)).toBe(true)
    expect(isEmptyPlan({ ...EMPTY_PLAN, verifications: [{} as never] })).toBe(false)
  })
})

describe("the whole seeded story, v1 then v2", () => {
  it("opens 8 modes after v1, then resolves 6 and keeps 2 open after v2, verifying the shipped fixes", () => {
    const run1 = makeRun("v1", V1_FAIL, "2026-09-22T09:05:00Z")
    const p1 = plan({ run: run1 })
    const afterV1 = apply([], [], p1, run1)
    expect(afterV1.modes).toHaveLength(8)

    // A fix shipped in v2 for each of four modes, plus one that will not be proven.
    const byTheme = (t: string) => afterV1.modes.find((m) => m.theme === t)!.id
    const fixes = [
      fix({ failureModeId: byTheme("expectation-gap") }),
      fix({ failureModeId: byTheme("fabrication-vocabulary") }),
      fix({ failureModeId: byTheme("persistent-wording") }),
      fix({ failureModeId: byTheme("negation") }),
      fix({ failureModeId: byTheme("sarcasm-and-idiom") }),
    ]

    const run2 = makeRun("v2", V2_FAIL, "2026-10-22T09:04:00Z")
    const p2 = plan({ run: run2, modes: afterV1.modes, fixes, previousFail: V1_FAIL })
    const afterV2 = apply(afterV1.modes, fixes, p2, run2)

    expect(afterV2.modes.filter((m) => m.status === "OPEN").map((m) => m.theme).sort()).toEqual([
      "frequency-vs-intensity",
      "sarcasm-and-idiom",
    ])
    expect(afterV2.modes.filter((m) => m.status === "RESOLVED")).toHaveLength(6)
    expect(afterV2.fixes.filter((f) => f.status === "VERIFIED")).toHaveLength(4)
    expect(afterV2.fixes.find((f) => f.failureModeId === byTheme("sarcasm-and-idiom"))!.status).toBe("SHIPPED")
    const sarcasm = afterV2.modes.find((m) => m.theme === "sarcasm-and-idiom")!
    expect(sarcasm.frequency).toBe(2)
    expect(sarcasm.regressedScenarioIds).toEqual(["d24"])
  })
})

describe("id lists stored as JSON text", () => {
  it("round-trips, sorted and without duplicates", () => {
    expect(parseIdList(formatIdList(["d12", "d11", "d11"]))).toEqual(["d11", "d12"])
  })

  it("writes the same text for the same ids in any order", () => {
    expect(formatIdList(["b", "a"])).toBe(formatIdList(["a", "b"]))
  })

  it.each([[null], [undefined], [""], ["not json"], ["{}"], ["42"], ["null"]])("reads %j as an empty list", (text) => {
    expect(parseIdList(text as string | null | undefined)).toEqual([])
  })

  it("drops entries that are not strings", () => {
    expect(parseIdList('["a", 3, null, "b"]')).toEqual(["a", "b"])
  })
})
