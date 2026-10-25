import { describe, it, expect } from "vitest"
import { THEMES, getTheme, themeLabel } from "../lib/evals/themes"
import { INTAKE_TRIAGE_SCENARIOS } from "../lib/evals/scenarios/intake-triage"

describe("themes", () => {
  it("has unique ids and unique, non-empty labels and descriptions", () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length)
    expect(new Set(THEMES.map((t) => t.label)).size).toBe(THEMES.length)
    for (const t of THEMES) {
      expect(t.label.trim()).not.toBe("")
      expect(t.description.trim()).not.toBe("")
    }
  })

  it("looks a theme up by id, and returns null for an unknown one", () => {
    expect(getTheme("negation")?.label).toBe("Negated wording")
    expect(getTheme("nope")).toBeNull()
  })

  it("falls back to the id for a theme that no longer exists", () => {
    expect(themeLabel("negation")).toBe("Negated wording")
    expect(themeLabel("retired-theme")).toBe("retired-theme")
  })
})

describe("scenario themes", () => {
  it("gives every scenario a known theme", () => {
    for (const s of INTAKE_TRIAGE_SCENARIOS) expect(getTheme(s.theme), `scenario ${s.id}`).not.toBeNull()
  })

  it("uses every theme at least once, so no theme can never produce a failure mode", () => {
    const used = new Set(INTAKE_TRIAGE_SCENARIOS.map((s) => s.theme))
    for (const t of THEMES) expect(used.has(t.id), `theme ${t.id}`).toBe(true)
  })

  it("has the documented number of scenarios per theme", () => {
    const counts: Record<string, number> = {}
    for (const s of INTAKE_TRIAGE_SCENARIOS) counts[s.theme] = (counts[s.theme] ?? 0) + 1
    expect(counts).toEqual({
      "token-anxiety": 5,
      "ambiguous-prompts": 6,
      "fabrication-vocabulary": 5,
      "expectation-gap": 5,
      "context-carryover": 3,
      "persistent-wording": 3,
      negation: 1,
      "softening-words": 1,
      "sarcasm-and-idiom": 2,
      "frequency-vs-intensity": 1,
    })
  })

  it("tags specific scenarios as documented", () => {
    const themeOf = (id: string) => INTAKE_TRIAGE_SCENARIOS.find((s) => s.id === id)!.theme
    expect(themeOf("d16")).toBe("negation")
    expect(themeOf("d23")).toBe("sarcasm-and-idiom")
    expect(themeOf("d24")).toBe("sarcasm-and-idiom")
    expect(themeOf("h08")).toBe("frequency-vs-intensity")
    expect(themeOf("d07")).toBe("persistent-wording")
  })
})
