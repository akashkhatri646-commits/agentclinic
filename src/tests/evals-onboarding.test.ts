import { describe, it, expect } from "vitest"
import {
  MIN_HOLDOUT,
  MIN_SCENARIOS,
  computeAdoption,
  firstVerdictAt,
  firstVerifiedAt,
  isAssisted,
  isOnboarded,
  onboardingSteps,
  summariseOnboarding,
  type OnboardingFacts,
} from "../lib/evals/onboarding"
import { buildFacts, loadOnboardingFacts } from "../lib/evals/onboarding-queries"
import { DAY_MS } from "../lib/evals/metrics"

const d = (iso: string) => new Date(iso)

const facts = (over: Partial<OnboardingFacts> = {}): OnboardingFacts => ({
  slug: "router",
  ownerId: "owner",
  createdAt: d("2026-10-01T09:00:00Z"),
  scenarioCount: 12,
  holdoutCount: 4,
  versionCount: 0,
  runs: [],
  fixes: [],
  acts: [],
  isSample: false,
  ...over,
})
const run = (finish: string, triggeredBy: string | null = "owner") => ({ createdAt: d(finish), finishedAt: d(finish), triggeredBy })
const verifiedFix = (at = "2026-10-10T09:00:00Z") => ({ id: "f1", status: "VERIFIED", verifiedAt: d(at) })

const done = (f: OnboardingFacts) => Object.fromEntries(onboardingSteps(f).map((s) => [s.id, s.done]))

describe("onboardingSteps", () => {
  it("lists the six steps in order, with only the first done for a brand-new specialist", () => {
    const steps = onboardingSteps(facts({ scenarioCount: 1, holdoutCount: 0 }))
    expect(steps.map((s) => s.id)).toEqual(["create", "scenarios", "version", "verdict", "fix", "verified"])
    expect(steps.map((s) => s.done)).toEqual([true, false, false, false, false, false])
  })

  it("ticks the scenario step only with enough scenarios AND enough hold-out ones", () => {
    expect(done(facts({ scenarioCount: MIN_SCENARIOS, holdoutCount: MIN_HOLDOUT })).scenarios).toBe(true)
    expect(done(facts({ scenarioCount: MIN_SCENARIOS - 1, holdoutCount: MIN_HOLDOUT })).scenarios).toBe(false)
    expect(done(facts({ scenarioCount: 50, holdoutCount: MIN_HOLDOUT - 1 })).scenarios).toBe(false)
    expect(done(facts({ scenarioCount: 50, holdoutCount: 0 })).scenarios).toBe(false)
  })

  it("says what is missing for the scenario step, in words", () => {
    const step = onboardingSteps(facts({ scenarioCount: 4, holdoutCount: 1 })).find((s) => s.id === "scenarios")!
    expect(step.detail).toBe("Needs 2 more scenarios and 1 more hold-out scenario.")
    expect(onboardingSteps(facts()).find((s) => s.id === "scenarios")!.detail).toBeNull()
  })

  it("ticks the version step when a version exists, and the verdict step when a run exists", () => {
    expect(done(facts({ versionCount: 1 })).version).toBe(true)
    expect(done(facts({ versionCount: 1 })).verdict).toBe(false)
    expect(done(facts({ versionCount: 1, runs: [run("2026-10-03T09:00:00Z")] })).verdict).toBe(true)
  })

  it("ticks the fix steps from the fixes: proposed, then verified", () => {
    const proposed = facts({ fixes: [{ id: "f", status: "PROPOSED", verifiedAt: null }] })
    expect([done(proposed).fix, done(proposed).verified]).toEqual([true, false])
    const shipped = facts({ fixes: [{ id: "f", status: "SHIPPED", verifiedAt: null }] })
    expect(done(shipped).verified).toBe(false)
    expect(done(facts({ fixes: [verifiedFix()] })).verified).toBe(true)
  })

  it("links each step that has a page, with the specialist in the address", () => {
    const steps = onboardingSteps(facts({ slug: "a b" }))
    expect(steps.find((s) => s.id === "version")!.href).toBe("/dashboard/specialists/a%20b/import")
    expect(steps.find((s) => s.id === "fix")!.href).toBe("/dashboard/triage?specialist=a%20b")
  })

  it("does not tick later steps because of earlier ones", () => {
    const f = facts({ versionCount: 1, runs: [run("2026-10-03T09:00:00Z")] })
    expect([done(f).fix, done(f).verified]).toEqual([false, false])
  })
})

describe("first verdict and first verified fix", () => {
  it("takes the earliest finish time, falling back to creation", () => {
    const f = facts({ runs: [run("2026-10-09T00:00:00Z"), run("2026-10-03T00:00:00Z"), { createdAt: d("2026-10-06T00:00:00Z"), finishedAt: null, triggeredBy: null }] })
    expect(firstVerdictAt(f)).toEqual(d("2026-10-03T00:00:00Z"))
    expect(firstVerdictAt(facts())).toBeNull()
  })

  it("takes the earliest verification, and none when nothing is verified", () => {
    expect(firstVerifiedAt(facts({ fixes: [verifiedFix("2026-10-12T00:00:00Z"), { ...verifiedFix("2026-10-08T00:00:00Z"), id: "f2" }] }))).toEqual(d("2026-10-08T00:00:00Z"))
    expect(firstVerifiedAt(facts({ fixes: [{ id: "f", status: "SHIPPED", verifiedAt: null }] }))).toBeNull()
  })
})

describe("isOnboarded", () => {
  it("needs a verdict and a verified fix", () => {
    expect(isOnboarded(facts({ runs: [run("2026-10-03T00:00:00Z")], fixes: [verifiedFix()] }))).toBe(true)
    expect(isOnboarded(facts({ runs: [run("2026-10-03T00:00:00Z")] }))).toBe(false)
    expect(isOnboarded(facts({ fixes: [verifiedFix()] }))).toBe(false)
    expect(isOnboarded(facts({ runs: [run("2026-10-03T00:00:00Z")], fixes: [{ id: "f", status: "SHIPPED", verifiedAt: null }] }))).toBe(false)
  })
})

describe("isAssisted", () => {
  const base = { runs: [run("2026-10-03T00:00:00Z")], fixes: [verifiedFix("2026-10-10T00:00:00Z")] }
  const act = (actorId: string | null, actorRole: string | null, at: string) => ({ actorId, actorRole, at: d(at) })

  it("is false when only the owner acted", () => {
    expect(isAssisted(facts({ ...base, acts: [act("owner", "STAFF", "2026-10-02T00:00:00Z")] }))).toBe(false)
  })

  it("is false when an admin owner acted on their own specialist", () => {
    expect(isAssisted(facts({ ...base, acts: [act("owner", "ADMIN", "2026-10-02T00:00:00Z")] }))).toBe(false)
  })

  it("is true when an admin other than the owner acted before the first verified fix", () => {
    expect(isAssisted(facts({ ...base, acts: [act("someone", "ADMIN", "2026-10-02T00:00:00Z")] }))).toBe(true)
  })

  it("counts an admin acting at the very moment of verification", () => {
    expect(isAssisted(facts({ ...base, acts: [act("someone", "ADMIN", "2026-10-10T00:00:00Z")] }))).toBe(true)
  })

  it("counts every admin act when a verified fix has no recorded time", () => {
    const undated = { id: "f", status: "VERIFIED", verifiedAt: null }
    expect(isAssisted(facts({ runs: [run("2026-10-03T00:00:00Z")], fixes: [undated], acts: [act("someone", "ADMIN", "2026-10-02T00:00:00Z")] }))).toBe(true)
    expect(firstVerifiedAt(facts({ fixes: [undated] }))!.getTime()).toBeGreaterThan(Date.UTC(3000, 0, 1))
  })

  it("ignores an admin acting after the first verified fix", () => {
    expect(isAssisted(facts({ ...base, acts: [act("someone", "ADMIN", "2026-10-11T00:00:00Z")] }))).toBe(false)
  })

  it("does not count other staff, the system, or an unknown actor", () => {
    const acts = [act("colleague", "STAFF", "2026-10-02T00:00:00Z"), act(null, null, "2026-10-02T00:00:00Z"), act("ghost", null, "2026-10-02T00:00:00Z")]
    expect(isAssisted(facts({ ...base, acts }))).toBe(false)
  })

  it("counts any admin act when nothing is verified yet", () => {
    expect(isAssisted(facts({ acts: [act("someone", "ADMIN", "2030-01-01T00:00:00Z")] }))).toBe(true)
    expect(isAssisted(facts({ acts: [] }))).toBe(false)
  })
})

describe("summariseOnboarding and computeAdoption", () => {
  const onboarded = (over: Partial<OnboardingFacts> = {}) =>
    facts({ runs: [run("2026-10-03T09:00:00Z")], versionCount: 1, fixes: [verifiedFix()], ...over })
  const assistedActs = [{ actorId: "admin", actorRole: "ADMIN", at: d("2026-10-02T00:00:00Z") }]

  it("measures time from creation to the first verdict", () => {
    const s = summariseOnboarding(facts({ runs: [run("2026-10-03T09:00:00Z")] }))
    expect(s.msToFirstVerdict).toBe(2 * DAY_MS)
    expect(s.hasVerdict).toBe(true)
    expect(summariseOnboarding(facts()).msToFirstVerdict).toBeNull()
  })

  it("never reports a negative time (a verdict dated before creation reads as zero)", () => {
    expect(summariseOnboarding(facts({ runs: [run("2026-09-01T00:00:00Z")] })).msToFirstVerdict).toBe(0)
  })

  it("counts steps done", () => {
    expect(summariseOnboarding(facts({ scenarioCount: 1, holdoutCount: 0 })).doneCount).toBe(1)
    expect(summariseOnboarding(onboarded()).doneCount).toBe(6)
  })

  it("reports zeros and no share for no specialists", () => {
    expect(computeAdoption([])).toEqual({
      specialists: 0, withVerdict: 0, onboarded: 0, unassisted: 0, unassistedShare: null, medianMsToFirstVerdict: null, sampleSpecialists: 0,
    })
  })

  it("gives no share when nobody is onboarded yet", () => {
    const a = computeAdoption([summariseOnboarding(facts({ runs: [run("2026-10-03T09:00:00Z")] }))])
    expect(a).toMatchObject({ specialists: 1, withVerdict: 1, onboarded: 0, unassisted: 0, unassistedShare: null })
  })

  it("computes the seeded story: 4 specialists, 4 with a verdict, 3 onboarded, 2 unassisted, median 5.5 days", () => {
    const at = (days: number) => run(new Date(d("2026-10-01T09:00:00Z").getTime() + days * DAY_MS).toISOString())
    const list = [
      summariseOnboarding(onboarded({ slug: "a", runs: [at(21)] })),
      summariseOnboarding(onboarded({ slug: "b", runs: [at(2)] })),
      summariseOnboarding(onboarded({ slug: "c", runs: [at(9)], acts: assistedActs })),
      summariseOnboarding(facts({ slug: "d", runs: [at(2)], fixes: [{ id: "f", status: "IN_PROGRESS", verifiedAt: null }] })),
    ]
    const a = computeAdoption(list)
    expect(a).toMatchObject({ specialists: 4, withVerdict: 4, onboarded: 3, unassisted: 2 })
    expect(a.unassistedShare).toBeCloseTo(2 / 3)
    expect(a.medianMsToFirstVerdict).toBe(5.5 * DAY_MS)
  })

  it("counts sample specialists", () => {
    const a = computeAdoption([summariseOnboarding(facts({ isSample: true })), summariseOnboarding(facts())])
    expect(a.sampleSpecialists).toBe(1)
  })
})

describe("buildFacts", () => {
  const specialist = (slug: string, over = {}) => ({
    slug, ownerId: "owner", createdAt: d("2026-10-01T00:00:00Z"), isSample: false,
    scenarios: [{ split: "DEV" }, { split: "DEV" }, { split: "HOLDOUT" }], versions: [{}],
    events: [{ actorId: "owner", actorRole: "STAFF", createdAt: d("2026-10-01T00:00:00Z") }], ...over,
  })
  const users = [{ id: "owner", role: "STAFF" }, { id: "admin", role: "ADMIN" }]

  it("counts scenarios and hold-out scenarios and versions per specialist", () => {
    const [f] = buildFacts({ specialists: [specialist("a")], runs: [], fixes: [], fixEvents: [], users })
    expect([f.scenarioCount, f.holdoutCount, f.versionCount]).toEqual([3, 1, 1])
  })

  it("keeps each specialist's runs and fixes apart", () => {
    const list = buildFacts({
      specialists: [specialist("a"), specialist("b")],
      runs: [{ specialistId: "a", createdAt: d("2026-10-02T00:00:00Z"), finishedAt: null, triggeredBy: "owner", isSample: false }],
      fixes: [{ id: "f1", status: "VERIFIED", verifiedAt: d("2026-10-05T00:00:00Z"), failureMode: { specialistId: "b" } }],
      fixEvents: [], users,
    })
    expect([list[0].runs.length, list[0].fixes.length, list[1].runs.length, list[1].fixes.length]).toEqual([1, 0, 0, 1])
  })

  it("turns people's runs and fix moves into acts with their roles, and ignores the CLI, the seed and the system", () => {
    const [f] = buildFacts({
      specialists: [specialist("a")],
      runs: [
        { specialistId: "a", createdAt: d("2026-10-02T00:00:00Z"), finishedAt: d("2026-10-02T01:00:00Z"), triggeredBy: "admin", isSample: false },
        { specialistId: "a", createdAt: d("2026-10-02T00:00:00Z"), finishedAt: null, triggeredBy: "cli", isSample: false },
        { specialistId: "a", createdAt: d("2026-10-02T00:00:00Z"), finishedAt: null, triggeredBy: "seed", isSample: false },
      ],
      fixes: [{ id: "f1", status: "SHIPPED", verifiedAt: null, failureMode: { specialistId: "a" } }],
      fixEvents: [
        { fixId: "f1", actorId: "admin", at: d("2026-10-03T00:00:00Z") },
        { fixId: "f1", actorId: null, at: d("2026-10-04T00:00:00Z") },
        { fixId: "other", actorId: "admin", at: d("2026-10-04T00:00:00Z") },
      ],
      users,
    })
    const adminActs = f.acts.filter((a) => a.actorId === "admin")
    expect(adminActs.map((a) => a.actorRole)).toEqual(["ADMIN", "ADMIN"])
    expect(f.acts.some((a) => a.actorId === "cli" || a.actorId === "seed")).toBe(false)
    expect(f.acts.some((a) => a.actorId === null)).toBe(false)
  })

  it("marks a specialist with sample runs as sample", () => {
    const [f] = buildFacts({
      specialists: [specialist("a")],
      runs: [{ specialistId: "a", createdAt: d("2026-10-02T00:00:00Z"), finishedAt: null, triggeredBy: null, isSample: true }],
      fixes: [], fixEvents: [], users,
    })
    expect(f.isSample).toBe(true)
  })

  it("reports an assisted specialist end to end", () => {
    const [f] = buildFacts({
      specialists: [specialist("a")],
      runs: [{ specialistId: "a", createdAt: d("2026-10-02T00:00:00Z"), finishedAt: d("2026-10-02T00:00:00Z"), triggeredBy: "admin", isSample: false }],
      fixes: [{ id: "f1", status: "VERIFIED", verifiedAt: d("2026-10-09T00:00:00Z"), failureMode: { specialistId: "a" } }],
      fixEvents: [], users,
    })
    expect(summariseOnboarding(f)).toMatchObject({ onboarded: true, assisted: true })
  })
})

describe("loadOnboardingFacts", () => {
  const empty = async () => []
  function fakeDb() {
    const calls: Record<string, unknown> = {}
    const table = (name: string) => ({ findMany: async (args: unknown) => { calls[name] = args; return [] } })
    const db = { specialist: table("specialist"), evalRun: table("evalRun"), fix: table("fix"), fixEvent: table("fixEvent"), user: { findMany: empty } }
    return { db: db as unknown as Parameters<typeof loadOnboardingFacts>[0], calls }
  }

  it("reads everything when no specialist is named", async () => {
    const { db, calls } = fakeDb()
    await loadOnboardingFacts(db)
    for (const name of ["specialist", "evalRun", "fix", "fixEvent"]) expect(calls[name]).not.toHaveProperty("where")
  })

  it("reads only the named specialist's rows when one is named", async () => {
    const { db, calls } = fakeDb()
    await loadOnboardingFacts(db, "ticket-router")
    expect(calls.specialist).toMatchObject({ where: { slug: "ticket-router" } })
    expect(calls.evalRun).toMatchObject({ where: { specialistId: "ticket-router" } })
    expect(calls.fix).toMatchObject({ where: { failureMode: { specialistId: "ticket-router" } } })
    expect(calls.fixEvent).toMatchObject({ where: { fix: { failureMode: { specialistId: "ticket-router" } } } })
  })
})
