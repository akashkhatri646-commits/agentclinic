import { describe, it, expect } from "vitest"
import { SAMPLE_SPECIALISTS, sampleOutputs } from "../lib/evals/sample-specialists"
import { SAMPLE_INTAKE_CREATED_AT, SAMPLE_TIMING } from "../lib/evals/sample-data"
import { gradeOutputs } from "../lib/evals/grade"
import { computeVerdict } from "../lib/evals/verdict"
import { getTemplate, templateText } from "../lib/evals/templates"
import { validateSpecialistConfig } from "../lib/evals/spec"

const spec = (() => {
  const r = validateSpecialistConfig(templateText(getTemplate("classification")!))
  if (!r.ok) throw new Error("template invalid")
  return r.spec
})()

describe("sample specialists", () => {
  it("has three, with distinct slugs that are valid specialist slugs", () => {
    expect(SAMPLE_SPECIALISTS.map((s) => s.slug)).toEqual(["ticket-router", "refund-triage", "intent-detector"])
    for (const s of SAMPLE_SPECIALISTS) {
      expect(validateSpecialistConfig(JSON.stringify({ ...JSON.parse(templateText(getTemplate("classification")!)), slug: s.slug, name: s.name, description: s.description })).ok).toBe(true)
    }
  })

  it("never uses the built-in specialist's slug", () => {
    expect(SAMPLE_SPECIALISTS.some((s) => s.slug === "intake-triage")).toBe(false)
  })

  it.each(SAMPLE_SPECIALISTS.map((s) => [s.slug, s] as const))("%s has ordered, sensible dates", (_slug, s) => {
    let previousRelease = s.createdAt.getTime() - 1
    for (const v of s.versions) {
      expect(v.releasedAt.getTime()).toBeGreaterThan(previousRelease)
      expect(v.startedAt.getTime()).toBeGreaterThanOrEqual(v.releasedAt.getTime())
      expect(v.finishedAt.getTime()).toBeGreaterThanOrEqual(v.startedAt.getTime())
      previousRelease = v.releasedAt.getTime()
    }
    for (const f of s.fixes) {
      expect(s.versions.some((v) => v.label === f.afterVersion)).toBe(true)
      expect(f.startedAt.getTime()).toBeGreaterThanOrEqual(f.createdAt.getTime())
      if (f.shipped) {
        expect(s.versions.some((v) => v.label === f.shipped!.version)).toBe(true)
        expect(f.shipped.at.getTime()).toBeGreaterThanOrEqual(f.startedAt.getTime())
      }
    }
  })

  it("v1 of each fails and later versions pass, so a fix can be verified by a run", async () => {
    for (const s of SAMPLE_SPECIALISTS) {
      for (const v of s.versions) {
        const graded = await gradeOutputs({ spec, outputs: sampleOutputs(spec, v.wrong), lists: {} })
        const verdict = computeVerdict(graded).verdict
        expect([s.slug, v.label, verdict]).toEqual([s.slug, v.label, v.label === "v1" ? "FAIL" : "PASS"])
      }
    }
  })

  it("answers wrongly only where told, by giving the other category", () => {
    const outputs = sampleOutputs(spec, ["d05"])
    expect(outputs.d05.category).not.toBe(spec.scenarios.find((s) => s.id === "d05")!.expected.category)
    expect(outputs.d01.category).toBe(spec.scenarios.find((s) => s.id === "d01")!.expected.category)
  })

  it("makes only the edge-cases theme fail in v1, so one failure mode is created", async () => {
    const graded = await gradeOutputs({ spec, outputs: sampleOutputs(spec, ["d05", "d06", "d07"]), lists: {} })
    const themes = new Set(graded.rows.filter((r) => !r.passed).map((r) => r.theme))
    expect(Array.from(themes)).toEqual(["edge-cases"])
  })

  it("tells the adoption story: first verdicts after 2, 9 and 2 days, and 21 for the built-in specialist", () => {
    const days = (s: (typeof SAMPLE_SPECIALISTS)[number]) => (s.versions[0].finishedAt.getTime() - s.createdAt.getTime()) / 86_400_000
    expect(SAMPLE_SPECIALISTS.map(days)).toEqual([2, 9, 2])
    expect((SAMPLE_TIMING.v1.finishedAt.getTime() - SAMPLE_INTAKE_CREATED_AT.getTime()) / 86_400_000).toBeCloseTo(21, 1)
  })

  it("has exactly one specialist an admin helps, and one that is not yet onboarded", () => {
    expect(SAMPLE_SPECIALISTS.filter((s) => s.versions.some((v) => v.importedBy === "admin")).map((s) => s.slug)).toEqual(["refund-triage"])
    expect(SAMPLE_SPECIALISTS.filter((s) => !s.fixes.some((f) => f.shipped)).map((s) => s.slug)).toEqual(["intent-detector"])
  })
})
