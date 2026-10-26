import { describe, it, expect } from "vitest"
import { intakeTriageSpec } from "../lib/evals/builtin-spec"

const scenarios = intakeTriageSpec.scenarios
import {
  buildBacklog,
  currentRun,
  FIX_STATUS_LABEL,
  describeEvent,
  describeFixes,
  scenarioRows,
  statusActionLabel,
  toBacklogItem,
  toFixView,
  type FixRow,
  type ModeRow,
  type RunRef,
} from "../lib/evals/triage-view"

const at = (iso: string) => new Date(iso)
const order = ["v1", "v2", "v3"]

let n = 1
const fixRow = (over: Partial<FixRow> = {}): FixRow => ({
  id: `f${n++}`,
  title: "A fix",
  description: null,
  status: "PROPOSED",
  ownerId: null,
  owner: null,
  shippedVersion: null,
  shippedAt: null,
  verifiedAt: null,
  verifiedByRunId: null,
  isSample: false,
  createdAt: at("2026-09-23T10:00:00Z"),
  ...over,
})

const modeRow = (over: Partial<ModeRow> = {}): ModeRow => ({
  id: `m${n++}`,
  theme: "negation",
  status: "OPEN",
  frequency: 1,
  totalScenarios: 1,
  failingScenarioIds: '["d16"]',
  regressedScenarioIds: "[]",
  suggestedSeverity: 2,
  severityOverride: null,
  effort: 2,
  lastRunId: "run-v2",
  lastRunVersion: "v2",
  firstSeenAt: at("2026-09-22T09:05:00Z"),
  resolvedAt: null,
  reappeared: false,
  reappearedAt: null,
  fixes: [],
  ...over,
})

const run = (id: string, version: string, finished: string | null, created = "2026-10-22T09:04:00Z"): RunRef => ({
  id,
  version,
  finishedAt: finished ? at(finished) : null,
  createdAt: at(created),
})

describe("currentRun", () => {
  it("is null when there are no runs, or none of a known version", () => {
    expect(currentRun([], order)).toBeNull()
    expect(currentRun([run("a", "v9", "2026-10-22T09:04:00Z")], order)).toBeNull()
  })

  it("is the latest run of the latest-released version that has been evaluated", () => {
    const runs = [run("a", "v1", "2026-09-22T09:05:00Z"), run("b", "v2", "2026-10-22T09:04:00Z"), run("c", "v2", "2026-10-23T09:04:00Z")]
    expect(currentRun(runs, order)?.id).toBe("c")
  })

  it("is not a re-run of an older version, even if it is the most recent run", () => {
    const runs = [run("b", "v2", "2026-10-22T09:04:00Z"), run("late-v1", "v1", "2026-11-30T00:00:00Z")]
    expect(currentRun(runs, order)?.id).toBe("b")
  })

  it("uses createdAt when a run has no finish time", () => {
    const runs = [run("a", "v2", null, "2026-10-01T00:00:00Z"), run("b", "v2", null, "2026-10-02T00:00:00Z")]
    expect(currentRun(runs, order)?.id).toBe("b")
  })
})

describe("describeFixes", () => {
  const view = (over: Partial<FixRow>, frequency = 0) => toFixView(fixRow(over), { frequency })

  it("says so when there is no fix", () => expect(describeFixes([])).toBe("No fix yet"))

  it("counts fixes by stage, in words", () => {
    const fixes = [
      view({ status: "VERIFIED" }),
      view({ status: "VERIFIED" }),
      view({ status: "IN_PROGRESS" }),
      view({ status: "PROPOSED" }),
    ]
    expect(describeFixes(fixes)).toBe("2 verified, 1 in progress, 1 proposed")
  })

  it("separates a shipped fix that is not yet proven from one that is shipped with the mode passing", () => {
    expect(describeFixes([view({ status: "SHIPPED" }, 2)])).toBe("1 shipped, not yet verified")
    expect(describeFixes([view({ status: "SHIPPED" }, 0)])).toBe("1 shipped")
  })
})

describe("toFixView", () => {
  it("flags only a shipped fix whose mode still fails as unverified", () => {
    expect(toFixView(fixRow({ status: "SHIPPED" }), { frequency: 1 }).unverified).toBe(true)
    expect(toFixView(fixRow({ status: "SHIPPED" }), { frequency: 0 }).unverified).toBe(false)
    expect(toFixView(fixRow({ status: "VERIFIED" }), { frequency: 1 }).unverified).toBe(false)
  })

  it("shows the owner's email, or none", () => {
    expect(toFixView(fixRow({ owner: { id: "u", email: "a@b" } }), { frequency: 0 }).ownerEmail).toBe("a@b")
    expect(toFixView(fixRow(), { frequency: 0 }).ownerEmail).toBeNull()
  })

  it("reads an unrecognised stored status as proposed instead of failing", () => {
    expect(toFixView(fixRow({ status: "weird" }), { frequency: 0 }).status).toBe("PROPOSED")
  })
})

describe("toBacklogItem", () => {
  it("computes the score from frequency, severity and effort, and the label from the theme", () => {
    const item = toBacklogItem(modeRow({ theme: "sarcasm-and-idiom", frequency: 2, suggestedSeverity: 2, effort: 2 }))
    expect(item.label).toBe("Sarcasm and idiom")
    expect(item.severity).toBe(2)
    expect(item.score).toBeCloseTo(2)
  })

  it("uses the severity override and shows both the suggestion and the override", () => {
    const item = toBacklogItem(modeRow({ frequency: 1, suggestedSeverity: 1, severityOverride: 3, effort: 1 }))
    expect(item.severity).toBe(3)
    expect(item.suggestedSeverity).toBe(1)
    expect(item.severityOverride).toBe(3)
    expect(item.score).toBeCloseTo(3)
  })

  it("reads the stored scenario lists, tolerating bad text", () => {
    const item = toBacklogItem(modeRow({ failingScenarioIds: '["d23","d24"]', regressedScenarioIds: "oops" }))
    expect(item.failingScenarioIds).toEqual(["d23", "d24"])
    expect(item.regressedScenarioIds).toEqual([])
  })

  it("orders a mode's fixes oldest first", () => {
    const item = toBacklogItem(
      modeRow({
        fixes: [
          fixRow({ id: "later", createdAt: at("2026-10-02T00:00:00Z") }),
          fixRow({ id: "earlier", createdAt: at("2026-09-01T00:00:00Z") }),
        ],
      })
    )
    expect(item.fixes.map((f) => f.id)).toEqual(["earlier", "later"])
  })
})

describe("buildBacklog", () => {
  const rows = () => [
    modeRow({ id: "sarcasm", theme: "sarcasm-and-idiom", frequency: 2, totalScenarios: 2, suggestedSeverity: 2, failingScenarioIds: '["d23","d24"]', regressedScenarioIds: '["d24"]' }),
    modeRow({ id: "freq", theme: "frequency-vs-intensity", frequency: 1, suggestedSeverity: 2 }),
    modeRow({ id: "neg", theme: "negation", status: "RESOLVED", frequency: 0, failingScenarioIds: "[]", resolvedAt: at("2026-10-22T09:04:00Z") }),
    modeRow({ id: "soft", theme: "softening-words", status: "RESOLVED", frequency: 0, failingScenarioIds: "[]", resolvedAt: at("2026-10-22T09:04:00Z") }),
  ]
  const runs = [run("r1", "v1", "2026-09-22T09:05:00Z"), run("r2", "v2", "2026-10-22T09:04:00Z")]

  it("ranks open modes by score and keeps resolved ones separate", () => {
    const b = buildBacklog(rows(), runs, order)
    expect(b.open.map((m) => m.id)).toEqual(["sarcasm", "freq"])
    expect(b.open.map((m) => m.score)).toEqual([2, 1])
    expect(b.resolved.map((m) => m.id).sort()).toEqual(["neg", "soft"])
  })

  it("says which version and run it reflects", () => {
    const b = buildBacklog(rows(), runs, order)
    expect(b.reflects).toEqual({ runId: "r2", version: "v2", at: at("2026-10-22T09:04:00Z") })
  })

  it("has no reflected run when nothing has been run", () => {
    expect(buildBacklog([], [], order).reflects).toBeNull()
  })

  it("counts the summary figures", () => {
    const b = buildBacklog(
      [
        ...rows(),
      ].map((m) =>
        m.id === "sarcasm"
          ? { ...m, fixes: [fixRow({ status: "SHIPPED" }), fixRow({ status: "PROPOSED" })] }
          : m.id === "freq"
            ? { ...m, fixes: [fixRow({ status: "IN_PROGRESS" })] }
            : m.id === "neg"
              ? { ...m, fixes: [fixRow({ status: "VERIFIED" }), fixRow({ status: "VERIFIED" })] }
              : m
      ),
      runs,
      order
    )
    expect(b.summary).toEqual({
      openModes: 2,
      failingScenarios: 3, // 2 + 1
      fixesInFlight: 2, // the shipped fix and the in-progress one
      verifiedFixes: 2,
      flagged: 1, // sarcasm has a regressed scenario
    })
  })

  it("flags an open mode that reappeared, and not a resolved one", () => {
    const b = buildBacklog(
      [modeRow({ id: "x", reappeared: true }), modeRow({ id: "y", status: "RESOLVED", frequency: 0, reappeared: true })],
      runs,
      order
    )
    expect(b.summary.flagged).toBe(1)
  })

  it("reports whether any fix is sample data", () => {
    expect(buildBacklog(rows(), runs, order).hasSampleFixes).toBe(false)
    const withSample = rows().map((m) => (m.id === "freq" ? { ...m, fixes: [fixRow({ isSample: true })] } : m))
    expect(buildBacklog(withSample, runs, order).hasSampleFixes).toBe(true)
  })

  it("shows the most recently resolved modes first", () => {
    const b = buildBacklog(
      [
        modeRow({ id: "old", status: "RESOLVED", frequency: 0, resolvedAt: at("2026-09-30T00:00:00Z") }),
        modeRow({ id: "new", status: "RESOLVED", frequency: 0, resolvedAt: at("2026-10-22T00:00:00Z") }),
      ],
      runs,
      order
    )
    expect(b.resolved.map((m) => m.id)).toEqual(["new", "old"])
  })

  it("is empty and valid with no modes", () => {
    const b = buildBacklog([], runs, order)
    expect(b.open).toEqual([])
    expect(b.resolved).toEqual([])
    expect(b.summary).toEqual({ openModes: 0, failingScenarios: 0, fixesInFlight: 0, verifiedFixes: 0, flagged: 0 })
  })
})

describe("scenarioRows", () => {
  it("lists the theme's scenarios with their state", () => {
    const rows = scenarioRows("sarcasm-and-idiom", scenarios, ["d23", "d24"], ["d24"], true)
    expect(rows.map((r) => r.id)).toEqual(["d23", "d24"])
    expect(rows.every((r) => r.passing === false)).toBe(true)
    expect(rows.find((r) => r.id === "d24")!.regressed).toBe(true)
    expect(rows.find((r) => r.id === "d23")!.regressed).toBe(false)
  })

  it("shows a scenario as passing when it is not in the failing list", () => {
    const rows = scenarioRows("expectation-gap", scenarios, ["d11"], [], true)
    expect(rows.find((r) => r.id === "d11")!.passing).toBe(false)
    expect(rows.find((r) => r.id === "d12")!.passing).toBe(true)
    expect(rows).toHaveLength(5)
  })

  it("says nothing about pass or fail when the mode has not been evaluated", () => {
    expect(scenarioRows("negation", scenarios, [], [], false)[0].passing).toBeNull()
  })

  it("returns nothing for an unknown theme", () => {
    expect(scenarioRows("nope", scenarios, [], [], true)).toEqual([])
  })
})

describe("wording", () => {
  it("labels every status in words", () => {
    expect(FIX_STATUS_LABEL).toEqual({
      PROPOSED: "Proposed",
      IN_PROGRESS: "In progress",
      SHIPPED: "Shipped",
      VERIFIED: "Verified",
    })
  })

  it("gives each allowed move a button label, and a sensible fallback otherwise", () => {
    expect(statusActionLabel("PROPOSED", "IN_PROGRESS")).toBe("Start work")
    expect(statusActionLabel("IN_PROGRESS", "SHIPPED")).toBe("Mark as shipped")
    expect(statusActionLabel("SHIPPED", "IN_PROGRESS")).toBe("Move back to in progress")
    expect(statusActionLabel("IN_PROGRESS", "PROPOSED")).toBe("Move back to proposed")
    expect(statusActionLabel("PROPOSED", "VERIFIED")).toBe("Move to verified")
  })

  it("describes each kind of history entry as a sentence", () => {
    expect(describeEvent({ kind: "CREATED", fromStatus: null, toStatus: "PROPOSED", note: "Owner: a@b." })).toBe(
      "Created as proposed. Owner: a@b."
    )
    expect(describeEvent({ kind: "STATUS", fromStatus: "IN_PROGRESS", toStatus: "SHIPPED", note: "Shipped in v2." })).toBe(
      "In progress to shipped. Shipped in v2."
    )
    expect(describeEvent({ kind: "STATUS", fromStatus: "PROPOSED", toStatus: "IN_PROGRESS", note: null })).toBe(
      "Proposed to in progress."
    )
    expect(describeEvent({ kind: "OWNER", fromStatus: "PROPOSED", toStatus: "PROPOSED", note: "Owner cleared." })).toBe(
      "Owner cleared."
    )
    expect(describeEvent({ kind: "VERIFIED", fromStatus: "SHIPPED", toStatus: "VERIFIED", note: null })).toBe(
      "Verified by a run."
    )
  })

  it("does not fail on an unknown kind or a status it does not know", () => {
    expect(describeEvent({ kind: "ODD", fromStatus: null, toStatus: null, note: null })).toBe("ODD")
    expect(describeEvent({ kind: "STATUS", fromStatus: "WEIRD", toStatus: "SHIPPED", note: null })).toBe("WEIRD to shipped.")
  })
})
