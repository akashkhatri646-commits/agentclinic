import { describe, it, expect } from "vitest"
import { configTextOf, describeCheck, describeSpecialistEvent, suggestNextVersion } from "../lib/evals/spec-view"
import { validateSpecialistConfig } from "../lib/evals/spec"
import { TEMPLATES, templateText } from "../lib/evals/templates"

describe("describeCheck", () => {
  it.each([
    [{ field: "severity", type: "equals" as const }, "severity must equal the scenario's expected value"],
    [{ field: "level", type: "oneOf" as const, values: ["low", "high"] }, "level must be one of: low, high"],
    [{ field: "therapy", type: "inReference" as const, list: "therapies" }, 'therapy must be in the environment\'s "therapies" list'],
    [{ field: "rationale", type: "nonEmpty" as const }, "rationale must not be empty"],
  ])("describes %j", (check, expected) => expect(describeCheck(check)).toBe(expected))
})

describe("describeSpecialistEvent", () => {
  it("has words for each event, and a readable fallback", () => {
    expect(describeSpecialistEvent("CREATED")).toBe("Created the specialist")
    expect(describeSpecialistEvent("OUTPUTS_IMPORTED")).toBe("Imported outputs")
    expect(describeSpecialistEvent("SOMETHING_NEW")).toBe("something new")
  })
})

describe("configTextOf", () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))("round-trips the %s template through validation", (_id, t) => {
    const first = validateSpecialistConfig(templateText(t))
    if (!first.ok) throw new Error("template invalid")
    const second = validateSpecialistConfig(configTextOf(first.spec))
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.spec).toEqual(first.spec)
  })

  it("leaves the judge out when there is none", () => {
    const r = validateSpecialistConfig(templateText(TEMPLATES.find((t) => t.id === "blank")!))
    if (!r.ok) throw new Error("invalid")
    expect(JSON.parse(configTextOf(r.spec))).not.toHaveProperty("judge")
  })
})

describe("suggestNextVersion", () => {
  it.each([
    [[], "v1"],
    [["v1"], "v2"],
    [["v1", "v2", "v10"], "v11"],
    [["v3", "beta"], "v4"],
    [["alpha"], "next"],
  ])("suggests for %j", (labels, expected) => expect(suggestNextVersion(labels)).toBe(expected))
})
