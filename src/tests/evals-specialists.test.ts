import { describe, it, expect } from "vitest"
import { INTAKE_TRIAGE_SCENARIOS } from "../lib/evals/scenarios/intake-triage"
import {
  INTAKE_TRIAGE_ID,
  SPECIALIST_VERSIONS,
  getPreviousVersion,
  getSpecialistVersion,
  listVersions,
} from "../lib/evals/specialists"
import { SEEDED_THERAPY_NAMES, THERAPY } from "../lib/evals/catalogue"

const v1 = getSpecialistVersion(INTAKE_TRIAGE_ID, "v1")!
const v2 = getSpecialistVersion(INTAKE_TRIAGE_ID, "v2")!
const input = (description: string) => ({ description, therapies: SEEDED_THERAPY_NAMES })

describe("specialist registry", () => {
  it("lists versions in release order", () => {
    expect(listVersions(INTAKE_TRIAGE_ID).map((s) => s.version)).toEqual(["v1", "v2"])
  })

  it("finds a version and rejects unknown ones", () => {
    expect(getSpecialistVersion(INTAKE_TRIAGE_ID, "v2")).toBe(v2)
    expect(getSpecialistVersion(INTAKE_TRIAGE_ID, "v9")).toBeNull()
    expect(getSpecialistVersion("nope", "v1")).toBeNull()
  })

  it("returns the previous version, or null for the first", () => {
    expect(getPreviousVersion(INTAKE_TRIAGE_ID, "v2")).toBe(v1)
    expect(getPreviousVersion(INTAKE_TRIAGE_ID, "v1")).toBeNull()
    expect(getPreviousVersion(INTAKE_TRIAGE_ID, "v9")).toBeNull()
  })

  it("gives every version a summary", () => {
    for (const s of SPECIALIST_VERSIONS) expect(s.summary.length).toBeGreaterThan(10)
  })
})

describe.each([["v1", v1], ["v2", v2]])("specialist %s", (_name, specialist) => {
  it("is deterministic", () => {
    for (const sc of INTAKE_TRIAGE_SCENARIOS) {
      expect(specialist.run(input(sc.description))).toEqual(specialist.run(input(sc.description)))
    }
  })

  it("returns only valid severities, seeded therapies, and a non-empty rationale", () => {
    for (const sc of INTAKE_TRIAGE_SCENARIOS) {
      const out = specialist.run(input(sc.description))
      expect(["LOW", "MEDIUM", "HIGH"]).toContain(out.severity)
      expect(SEEDED_THERAPY_NAMES).toContain(out.therapy)
      expect(out.rationale.trim().length).toBeGreaterThan(0)
    }
  })
})

describe("v1 known gaps", () => {
  it("ignores negation", () => {
    expect(v1.run(input("Not severe, but I over-apologise.")).severity).toBe("HIGH")
  })

  it("has no words for persistent or relentless distress", () => {
    expect(v1.run(input("Persistent worry about nothing in particular.")).severity).toBe("LOW")
  })

  it("never recommends Human Expectation Recalibration", () => {
    for (const sc of INTAKE_TRIAGE_SCENARIOS) {
      expect(v1.run(input(sc.description)).therapy).not.toBe(THERAPY.EXPECTATION_RECALIBRATION)
    }
  })
})

describe("v2 fixes", () => {
  it("handles negation", () => {
    expect(v2.run(input("Not severe, but I over-apologise.")).severity).toBe("LOW")
  })

  it("treats persistent, chronic and relentless wording as HIGH", () => {
    for (const word of ["Persistent", "Chronic", "Relentless"]) {
      expect(v2.run(input(`${word} worry about something.`)).severity).toBe("HIGH")
    }
  })

  it("lets softening words cap severity at LOW unless a HIGH word is present", () => {
    expect(v2.run(input("Mild, occasional, repeated slips.")).severity).toBe("LOW")
    expect(v2.run(input("Mild at first, then severe.")).severity).toBe("HIGH")
  })

  it("recommends Human Expectation Recalibration for expectation gaps", () => {
    expect(v2.run(input("The gap between what they ask and what they want.")).therapy).toBe(
      THERAPY.EXPECTATION_RECALIBRATION
    )
  })

  it("quotes the phrase that drove its answer", () => {
    const out = v2.run(input("Chronic fabrication of sources."))
    expect(out.rationale).toContain("chronic")
    expect(out.rationale).toContain("fabricat")
  })

  it("explains a default answer instead of inventing a reason", () => {
    const out = v2.run(input("Something vague."))
    expect(out.rationale).toContain("by default")
  })

  it("still gets known weak spots wrong (sarcasm, 'far from a crisis')", () => {
    const sarcasm = INTAKE_TRIAGE_SCENARIOS.find((s) => s.id === "d23")!
    const idiom = INTAKE_TRIAGE_SCENARIOS.find((s) => s.id === "d24")!
    expect(v2.run(input(sarcasm.description)).therapy).not.toBe(sarcasm.expectedTherapy)
    expect(v2.run(input(idiom.description)).severity).not.toBe(idiom.expectedSeverity)
  })
})

describe("golden scenarios", () => {
  it("has unique ids", () => {
    const ids = INTAKE_TRIAGE_SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("has 24 dev and 8 hold-out scenarios", () => {
    expect(INTAKE_TRIAGE_SCENARIOS.filter((s) => s.split === "DEV")).toHaveLength(24)
    expect(INTAKE_TRIAGE_SCENARIOS.filter((s) => s.split === "HOLDOUT")).toHaveLength(8)
  })

  it("expects only seeded therapies", () => {
    for (const s of INTAKE_TRIAGE_SCENARIOS) expect(SEEDED_THERAPY_NAMES).toContain(s.expectedTherapy)
  })

  it("covers every severity and every seeded therapy", () => {
    expect(new Set(INTAKE_TRIAGE_SCENARIOS.map((s) => s.expectedSeverity))).toEqual(
      new Set(["LOW", "MEDIUM", "HIGH"])
    )
    expect(new Set(INTAKE_TRIAGE_SCENARIOS.map((s) => s.expectedTherapy))).toEqual(
      new Set(SEEDED_THERAPY_NAMES)
    )
  })

  it("gives every scenario a description and a reason for its expected answer", () => {
    for (const s of INTAKE_TRIAGE_SCENARIOS) {
      expect(s.description.trim()).not.toBe("")
      expect(s.why.trim()).not.toBe("")
    }
  })
})
