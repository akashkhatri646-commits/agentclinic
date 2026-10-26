import { describe, it, expect } from "vitest"
import { SAMPLE_FIXES } from "../lib/evals/sample-fixes"
import { SAMPLE_TIMING } from "../lib/evals/sample-data"
import { getTheme } from "../lib/evals/themes"
import { intakeTriageSpec } from "../lib/evals/builtin-spec"

const scenarios = intakeTriageSpec.scenarios
import { SPECIALIST_VERSIONS, getSpecialistVersion, INTAKE_TRIAGE_ID } from "../lib/evals/specialists"
import { planSync, type FixState, type ModeState, type SyncRun } from "../lib/evals/triage"

const SEEDED_OWNERS = ["staff@clinic.local", "admin@clinic.local"]
const order = SPECIALIST_VERSIONS.map((v) => v.version)
const results = (fail: string[]) => scenarios.map((s) => ({ scenarioId: s.id, passed: !fail.includes(s.id) }))

// What the real harness produces for the shipped specialists (pinned in evals-runner.test.ts).
const V1_FAIL = ["d05", "d06", "d07", "d11", "d12", "d13", "d16", "d17", "d19", "d21", "d22", "d23", "h01", "h02", "h04", "h05", "h08"]
const V2_FAIL = ["d23", "d24", "h08"]

describe("the sample fixes the seed creates", () => {
  it("target real themes, existing versions and seeded users", () => {
    for (const f of SAMPLE_FIXES) {
      expect(getTheme(f.theme), f.title).not.toBeNull()
      expect(SEEDED_OWNERS, f.title).toContain(f.ownerEmail)
      if (f.shippedVersion) expect(getSpecialistVersion(INTAKE_TRIAGE_ID, f.shippedVersion), f.title).not.toBeNull()
      expect(f.title.length).toBeLessThanOrEqual(120)
      expect(f.description.length).toBeLessThanOrEqual(1000)
    }
  })

  it("have times in lifecycle order, and ship both a time and a version or neither", () => {
    for (const f of SAMPLE_FIXES) {
      if (f.startedAt) expect(f.startedAt.getTime(), f.title).toBeGreaterThanOrEqual(f.createdAt.getTime())
      if (f.shippedAt) {
        expect(f.startedAt, `${f.title} ships without starting`).toBeDefined()
        expect(f.shippedAt.getTime(), f.title).toBeGreaterThanOrEqual((f.startedAt as Date).getTime())
        expect(f.shippedVersion, f.title).toBeDefined()
      } else {
        expect(f.shippedVersion, f.title).toBeUndefined()
      }
    }
  })

  it("are created after the run they follow, so the failure mode they target already exists", () => {
    for (const f of SAMPLE_FIXES) {
      expect(f.createdAt.getTime(), f.title).toBeGreaterThanOrEqual(SAMPLE_TIMING[f.afterRun].finishedAt.getTime())
    }
  })

  it("ship v2 at the same moment as the invented v2 release in the sample timeline", () => {
    for (const f of SAMPLE_FIXES.filter((x) => x.shippedVersion === "v2")) {
      expect(f.shippedAt, f.title).toEqual(SAMPLE_TIMING.v2.changeShippedAt)
    }
  })

  it("never ship in a version whose run already finished before the fix was made", () => {
    for (const f of SAMPLE_FIXES.filter((x) => x.shippedAt)) {
      expect(f.shippedAt!.getTime(), f.title).toBeGreaterThan(SAMPLE_TIMING.v1.finishedAt.getTime())
    }
  })

  it("tell the documented story when the real sync rules run over them", () => {
    // After the v1 run: the eight failure modes exist, and the v1-era fixes have been created and shipped.
    const run1: SyncRun = { id: "r1", version: "v1", finishedAt: SAMPLE_TIMING.v1.finishedAt, results: results(V1_FAIL) }
    const created = planSync({ run: run1, scenarios, modes: [], fixes: [], versionOrder: order, previousRun: null }).creates
    const modes: ModeState[] = created.map((c, i) => ({
      id: `m${i}`,
      theme: c.theme,
      status: "OPEN",
      frequency: c.frequency,
      failingScenarioIds: c.failingScenarioIds,
      regressedScenarioIds: c.regressedScenarioIds,
      suggestedSeverity: c.suggestedSeverity,
      lastRunId: "r1",
      lastRunVersion: "v1",
    }))
    expect(modes).toHaveLength(8)

    const idOf = (theme: string) => modes.find((m) => m.theme === theme)!.id
    const fixes: FixState[] = SAMPLE_FIXES.filter((f) => f.afterRun === "v1" && f.shippedVersion).map((f, i) => ({
      id: `f${i}`,
      failureModeId: idOf(f.theme),
      title: f.title,
      status: "SHIPPED",
      shippedVersion: f.shippedVersion as string,
      ownerId: null,
    }))
    expect(fixes).toHaveLength(5)

    // The v2 run verifies the four whose themes now pass, and not the sarcasm fix.
    const run2: SyncRun = { id: "r2", version: "v2", finishedAt: SAMPLE_TIMING.v2.finishedAt, results: results(V2_FAIL) }
    const plan = planSync({ run: run2, scenarios, modes, fixes, versionOrder: order, previousRun: { results: results(V1_FAIL) } })
    const verifiedThemes = plan.verifications
      .map((v) => modes.find((m) => m.id === v.failureModeId)!.theme)
      .sort()
    expect(verifiedThemes).toEqual(["expectation-gap", "fabrication-vocabulary", "negation", "persistent-wording"])
    expect(plan.verifications.every((v) => v.verifiedAt.getTime() === SAMPLE_TIMING.v2.finishedAt.getTime())).toBe(true)
  })

  it("leave two failure modes open after v2, each with a fix in a different state", () => {
    const afterV2 = SAMPLE_FIXES.filter((f) => f.afterRun === "v2")
    expect(afterV2.map((f) => f.theme).sort()).toEqual(["frequency-vs-intensity", "sarcasm-and-idiom"])
    expect(afterV2.find((f) => f.theme === "frequency-vs-intensity")!.startedAt).toBeDefined() // in progress
    expect(afterV2.find((f) => f.theme === "sarcasm-and-idiom")!.startedAt).toBeUndefined() // proposed
  })
})
