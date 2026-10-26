import { describe, it, expect } from "vitest"
import { LIMITS, PROVIDED_REFERENCE_LISTS, SPEC_FORMAT, validateSpecialistConfig, type ValidationError } from "../lib/evals/spec"
import { SEEDED_INSTANCES } from "../lib/evals/instances"

/** A small valid config, as an object, so each test can break exactly one thing. */
const base = (): Record<string, unknown> => ({
  format: SPEC_FORMAT,
  slug: "ticket-router",
  name: "Support ticket router",
  description: "Routes a ticket to a queue.",
  outputFields: [{ name: "queue", description: "The queue." }, { name: "rationale" }],
  checks: [
    { field: "queue", type: "equals" },
    { field: "rationale", type: "nonEmpty" },
  ],
  themes: [
    { id: "billing", label: "Billing questions", description: "Charges and refunds." },
    { id: "shipping", label: "Shipping" },
  ],
  judge: { field: "rationale" },
  scenarios: [
    { id: "s01", split: "DEV", theme: "billing", weight: 2, input: "I was charged twice.", expected: { queue: "billing" }, why: "A duplicate charge." },
    { id: "s02", split: "DEV", theme: "shipping", input: "Where is my parcel?", expected: { queue: "shipping" } },
    { id: "s03", split: "HOLDOUT", theme: "billing", weight: 1, input: "Refund please.", expected: { queue: "billing" } },
  ],
})

const run = (config: unknown) => validateSpecialistConfig(typeof config === "string" ? config : JSON.stringify(config))

/** Edits a copy of the base config. */
function with_(edit: (c: Record<string, unknown> & { scenarios: Record<string, unknown>[]; checks: Record<string, unknown>[]; outputFields: Record<string, unknown>[]; themes: Record<string, unknown>[] }) => void) {
  const c = base() as never
  edit(c)
  return c as unknown
}

const errorsOf = (config: unknown): ValidationError[] => {
  const r = run(config)
  if (r.ok) throw new Error("expected the config to be refused")
  return r.errors
}
const has = (errors: ValidationError[], path: string, fragment: string) =>
  errors.some((e) => e.path === path && e.message.includes(fragment))

describe("a valid config", () => {
  it("is accepted and normalised", () => {
    const r = run(base())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.spec.slug).toBe("ticket-router")
    expect(r.spec.outputFields.map((f) => f.name)).toEqual(["queue", "rationale"])
    expect(r.spec.outputFields[1].description).toBe("") // optional text becomes empty
    expect(r.spec.themes[1].description).toBe("")
    expect(r.spec.judge).toEqual({ field: "rationale" })
    expect(r.spec.scenarios).toHaveLength(3)
  })

  it("defaults a missing weight to 1 and a missing why to empty", () => {
    const r = run(base())
    if (!r.ok) throw new Error("should be valid")
    const s02 = r.spec.scenarios.find((s) => s.id === "s02")!
    expect(s02.weight).toBe(1)
    expect(s02.why).toBe("")
  })

  it("accepts a config with no judge", () => {
    const c = base()
    delete c.judge
    const r = run(c)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.spec.judge).toBeNull()
  })

  it("trims text and turns numbers and booleans into text in expected values", () => {
    const r = run(
      with_((c) => {
        c.outputFields.push({ name: "score" }, { name: "flag" })
        c.checks.push({ field: "score", type: "equals" }, { field: "flag", type: "equals" })
        c.scenarios[0].expected = { queue: "  billing  ", score: 3, flag: true }
        c.scenarios[1].expected = { queue: "shipping", score: 0, flag: false }
        c.scenarios[2].expected = { queue: "billing", score: 1, flag: true }
      })
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.spec.scenarios[0].expected).toEqual({ queue: "billing", score: "3", flag: "true" })
  })

  it("accepts the four check types", () => {
    const r = run(
      with_((c) => {
        c.outputFields.push({ name: "level" }, { name: "owner" })
        c.checks.push({ field: "level", type: "oneOf", values: ["low", "high"] }, { field: "owner", type: "inReference", list: "therapies" })
      })
    )
    expect(r.ok).toBe(true)
  })
})

describe("the whole document", () => {
  it.each([[""], ["   "]])("refuses an empty config %j", (text) => {
    const r = run(text)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0].message).toContain("empty")
  })

  it("refuses text that is not JSON, saying so", () => {
    const e = errorsOf("{ not json")
    expect(e).toHaveLength(1)
    expect(e[0].message).toContain("not valid JSON")
  })

  it.each([["[]"], ["42"], ["null"], ['"text"']])("refuses %s because it is not an object", (text) => {
    expect(errorsOf(text)[0].message).toContain("must be a JSON object")
  })

  it("refuses a document over the size limit without parsing it", () => {
    const e = errorsOf("x".repeat(LIMITS.maxBytes + 1))
    expect(e[0].message).toContain("over the 200 KB limit")
  })

  it("measures the size in bytes, not characters", () => {
    // 3-byte characters: under the limit in characters, over it in bytes.
    const text = "€".repeat(Math.floor(LIMITS.maxBytes / 3) + 10)
    expect(errorsOf(text)[0].message).toContain("KB")
  })

  it.each([[undefined, "is missing"], ["agentclinic.specialist/2", ""], ["something", ""]])(
    "refuses the format %j",
    (format, extra) => {
      const c = base()
      if (format === undefined) delete c.format
      else c.format = format
      const e = errorsOf(c)
      expect(has(e, "format", SPEC_FORMAT)).toBe(true)
      if (extra) expect(has(e, "format", extra)).toBe(true)
    }
  )

  it("refuses a property the format does not define, naming the allowed ones", () => {
    const e = errorsOf({ ...base(), scenarioz: [] })
    expect(has(e, "scenarioz", "not a recognised property")).toBe(true)
  })
})

describe("slug, name and description", () => {
  it.each([[undefined], [5], [""], ["Has Capitals"], ["has space"], ["-lead"], ["trail-"], ["double--hyphen"], ["x".repeat(41)]])(
    "refuses the slug %j",
    (slug) => {
      const c = base()
      if (slug === undefined) delete c.slug
      else c.slug = slug
      expect(errorsOf(c).some((e) => e.path === "slug")).toBe(true)
    }
  )

  it.each([["new"], ["edit"], ["import"]])("refuses the slug %j because it is a page address", (slug) => {
    expect(has(errorsOf({ ...base(), slug }), "slug", "reserved")).toBe(true)
  })

  it("refuses a missing, empty or over-long name", () => {
    for (const name of [undefined, "", "   ", "x".repeat(LIMITS.maxNameLength + 1)]) {
      const c = base()
      if (name === undefined) delete c.name
      else c.name = name
      expect(errorsOf(c).some((e) => e.path === "name")).toBe(true)
    }
  })

  it("refuses a description over the limit but allows leaving it out", () => {
    expect(errorsOf({ ...base(), description: "x".repeat(LIMITS.maxDescriptionLength + 1) }).some((e) => e.path === "description")).toBe(true)
    const c = base()
    delete c.description
    expect(run(c).ok).toBe(true)
  })
})

describe("output fields", () => {
  it.each([[undefined], [[]], ["queue"]])("refuses %j as the list of fields", (outputFields) => {
    const c = base()
    if (outputFields === undefined) delete c.outputFields
    else c.outputFields = outputFields
    expect(errorsOf(c).some((e) => e.path === "outputFields")).toBe(true)
  })

  it("refuses more than the limit of fields", () => {
    const fields = Array.from({ length: LIMITS.maxFields + 1 }, (_, i) => ({ name: `f${i}` }))
    expect(has(errorsOf({ ...base(), outputFields: fields }), "outputFields", "limit")).toBe(true)
  })

  it("refuses a duplicate field name", () => {
    const e = errorsOf(with_((c) => c.outputFields.push({ name: "queue" })))
    expect(has(e, "outputFields[2].name", "used twice")).toBe(true)
  })

  it.each([["1bad"], ["has space"], ["bad.dot"], [""], ["__proto__"], ["x".repeat(41)], ["constructor"], ["prototype"], ["toString"], ["hasOwnProperty"]])(
    "refuses the field name %j",
    (name) => {
      const e = errorsOf(with_((c) => c.outputFields.push({ name })))
      expect(e.some((x) => x.path === "outputFields[2].name")).toBe(true)
    }
  )

  it("refuses a field that is not an object", () => {
    expect(has(errorsOf(with_((c) => c.outputFields.push("queue" as never))), "outputFields[2]", "must be an object")).toBe(true)
  })
})

describe("checks", () => {
  it.each([[undefined], [[]]])("refuses %j as the list of checks", (checks) => {
    const c = base()
    if (checks === undefined) delete c.checks
    else c.checks = checks
    expect(errorsOf(c).some((e) => e.path === "checks")).toBe(true)
  })

  it("refuses an unknown check type, listing the real ones", () => {
    const e = errorsOf(with_((c) => c.checks.push({ field: "queue", type: "fuzzy" })))
    expect(has(e, "checks[2].type", "equals, oneOf, inReference, nonEmpty")).toBe(true)
  })

  it("refuses a check on a field that does not exist, naming the real fields", () => {
    const e = errorsOf(with_((c) => c.checks.push({ field: "quee", type: "equals" })))
    expect(has(e, "checks[2].field", '"quee" is not one of the output fields (queue, rationale)')).toBe(true)
  })

  it("refuses a check with no field", () => {
    expect(has(errorsOf(with_((c) => c.checks.push({ type: "equals" }))), "checks[2].field", "required")).toBe(true)
  })

  it.each([[undefined], [[]], ["a"], [[""]], [[{}]], [Array.from({ length: LIMITS.maxOneOfValues + 1 }, (_, i) => `v${i}`)]])(
    "refuses oneOf values %j",
    (values) => {
      const e = errorsOf(with_((c) => c.checks.push({ field: "queue", type: "oneOf", values })))
      expect(e.some((x) => x.path === "checks[2].values")).toBe(true)
    }
  )

  it("refuses an inReference list that no customer instance provides, naming the ones that exist", () => {
    const e = errorsOf(with_((c) => c.checks.push({ field: "queue", type: "inReference", list: "products" })))
    expect(has(e, "checks[2].list", '"products" is not a list any customer instance provides (available: therapies)')).toBe(true)
  })

  it("every seeded instance provides every list a check may name", () => {
    for (const instance of SEEDED_INSTANCES) {
      if (instance.referenceLists === null) continue // the standard clinic reads the live catalogue
      for (const list of PROVIDED_REFERENCE_LISTS) expect(Object.keys(instance.referenceLists)).toContain(list)
    }
    expect(PROVIDED_REFERENCE_LISTS).toContain("therapies") // provided live by the standard clinic
  })

  it("takes a higher size limit when reading a stored definition back", () => {
    const big = JSON.stringify({ ...base(), description: "x".repeat(LIMITS.maxDescriptionLength), pad: "y".repeat(LIMITS.maxBytes) })
    expect(validateSpecialistConfig(big).ok).toBe(false)
    const justOver = JSON.stringify(base()) + " ".repeat(LIMITS.maxBytes)
    expect(validateSpecialistConfig(justOver).ok).toBe(false)
    expect(validateSpecialistConfig(justOver, LIMITS.maxBytes * 4).ok).toBe(true)
  })

  it("refuses an inReference check with no list name or a bad one", () => {
    expect(errorsOf(with_((c) => c.checks.push({ field: "queue", type: "inReference" }))).some((e) => e.path === "checks[2].list")).toBe(true)
    expect(errorsOf(with_((c) => c.checks.push({ field: "queue", type: "inReference", list: "bad name" }))).some((e) => e.path === "checks[2].list")).toBe(true)
  })

  it("refuses a property that does not belong to the check type", () => {
    const e = errorsOf(with_((c) => c.checks.push({ field: "queue", type: "equals", values: ["a"] })))
    expect(has(e, "checks[2].values", "not a recognised property")).toBe(true)
  })

  it("refuses more than the limit of checks", () => {
    const checks = Array.from({ length: LIMITS.maxChecks + 1 }, () => ({ field: "queue", type: "equals" }))
    expect(has(errorsOf({ ...base(), checks }), "checks", "limit")).toBe(true)
  })
})

describe("themes", () => {
  it.each([[undefined], [[]]])("refuses %j as the list of themes", (themes) => {
    const c = base()
    if (themes === undefined) delete c.themes
    else c.themes = themes
    expect(errorsOf(c).some((e) => e.path === "themes")).toBe(true)
  })

  it("refuses a duplicate theme id", () => {
    expect(has(errorsOf(with_((c) => c.themes.push({ id: "billing", label: "Again" }))), "themes[2].id", "used twice")).toBe(true)
  })

  it.each([["__proto__"], ["constructor"], ["1x"], ["has space"]])("refuses the theme id %j", (id) => {
    expect(errorsOf(with_((c) => c.themes.push({ id, label: "X" }))).some((e) => e.path === "themes[2].id")).toBe(true)
  })

  it("refuses a theme with no label", () => {
    expect(has(errorsOf(with_((c) => c.themes.push({ id: "other" }))), "themes[2].label", "required")).toBe(true)
  })

  it("refuses more than the limit of themes", () => {
    const themes = Array.from({ length: LIMITS.maxThemes + 1 }, (_, i) => ({ id: `t${i}`, label: `T${i}` }))
    expect(has(errorsOf({ ...base(), themes }), "themes", "limit")).toBe(true)
  })
})

describe("the judge", () => {
  it("refuses a judge on a field that does not exist", () => {
    expect(has(errorsOf({ ...base(), judge: { field: "nope" } }), "judge.field", "output fields")).toBe(true)
  })

  it("refuses a judge that is not an object", () => {
    expect(has(errorsOf({ ...base(), judge: "rationale" }), "judge", "must be an object")).toBe(true)
  })
})

describe("scenarios", () => {
  it.each([[undefined], [[]]])("refuses %j as the list of scenarios", (scenarios) => {
    const c = base()
    if (scenarios === undefined) delete c.scenarios
    else c.scenarios = scenarios
    expect(errorsOf(c).some((e) => e.path === "scenarios")).toBe(true)
  })

  it("refuses more than the limit of scenarios", () => {
    const scenarios = Array.from({ length: LIMITS.maxScenarios + 1 }, (_, i) => ({
      id: `s${i}`, split: "DEV", theme: "billing", input: "x", expected: { queue: "billing" },
    }))
    expect(has(errorsOf({ ...base(), scenarios }), "scenarios", "limit")).toBe(true)
  })

  it("refuses a duplicate scenario id", () => {
    expect(has(errorsOf(with_((c) => (c.scenarios[1].id = "s01"))), "scenarios[1].id", "used twice")).toBe(true)
  })

  it.each([["x y"], ["1a"], ["__proto__"], ["constructor"], [""], [5]])("refuses the scenario id %j", (id) => {
    expect(errorsOf(with_((c) => (c.scenarios[1].id = id))).some((e) => e.path === "scenarios[1].id")).toBe(true)
  })

  it.each([["dev"], ["TEST"], [undefined], [1]])("refuses the split %j", (split) => {
    const e = errorsOf(with_((c) => (split === undefined ? delete c.scenarios[1].split : (c.scenarios[1].split = split))))
    expect(has(e, "scenarios[1].split", '"DEV" or "HOLDOUT"')).toBe(true)
  })

  it("refuses a scenario with an unknown theme, listing the real ones", () => {
    const e = errorsOf(with_((c) => (c.scenarios[0].theme = "biling")))
    expect(has(e, "scenarios[0].theme", '"biling" is not one of the themes (billing, shipping)')).toBe(true)
  })

  it.each([[0], [4], [-1], [2.5], ["2"], [null]])("refuses the weight %j", (weight) => {
    expect(has(errorsOf(with_((c) => (c.scenarios[0].weight = weight))), "scenarios[0].weight", "1, 2 or 3")).toBe(true)
  })

  it.each([[""], ["   "], [undefined], [5]])("refuses the input %j", (input) => {
    const e = errorsOf(with_((c) => (input === undefined ? delete c.scenarios[0].input : (c.scenarios[0].input = input))))
    expect(e.some((x) => x.path === "scenarios[0].input")).toBe(true)
  })

  it("refuses an input over the limit, saying how long it is", () => {
    const e = errorsOf(with_((c) => (c.scenarios[0].input = "x".repeat(LIMITS.maxInputLength + 1))))
    expect(has(e, "scenarios[0].input", `${LIMITS.maxInputLength + 1}`)).toBe(true)
  })

  it("refuses an expected value for a field that does not exist", () => {
    const e = errorsOf(with_((c) => (c.scenarios[0].expected = { queue: "billing", extra: "x" })))
    expect(has(e, "scenarios[0].expected.extra", "output fields")).toBe(true)
  })

  it("refuses a scenario with no expected value for an equals field", () => {
    expect(has(errorsOf(with_((c) => (c.scenarios[0].expected = {}))), "scenarios[0].expected.queue", '"equals"')).toBe(true)
    expect(has(errorsOf(with_((c) => (c.scenarios[0].expected = { queue: "" }))), "scenarios[0].expected.queue", '"equals"')).toBe(true)
  })

  it("refuses an expected value that is an object or a list", () => {
    expect(has(errorsOf(with_((c) => (c.scenarios[0].expected = { queue: { a: 1 } }))), "scenarios[0].expected.queue", "text, a number")).toBe(true)
    expect(has(errorsOf(with_((c) => (c.scenarios[0].expected = { queue: ["a"] }))), "scenarios[0].expected.queue", "text, a number")).toBe(true)
  })

  it("refuses expected that is not an object", () => {
    expect(has(errorsOf(with_((c) => (c.scenarios[0].expected = "billing"))), "scenarios[0].expected", "must be an object")).toBe(true)
  })

  it("needs at least one DEV scenario", () => {
    const e = errorsOf(with_((c) => c.scenarios.forEach((s) => (s.split = "HOLDOUT"))))
    expect(has(e, "scenarios", "at least one scenario with split DEV")).toBe(true)
  })

  it("does not need a hold-out scenario", () => {
    expect(run(with_((c) => c.scenarios.forEach((s) => (s.split = "DEV")))).ok).toBe(true)
  })

  it("refuses an unknown property on a scenario", () => {
    expect(has(errorsOf(with_((c) => (c.scenarios[0].severity = "HIGH"))), "scenarios[0].severity", "not a recognised property")).toBe(true)
  })
})

describe("prototype pollution", () => {
  it("does not pollute Object when a key is __proto__ in the JSON text", () => {
    const text = '{"format":"agentclinic.specialist/1","__proto__":{"polluted":true},"slug":"x"}'
    validateSpecialistConfig(text)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it("does not pollute Object through expected values or field names", () => {
    const text = JSON.stringify(base()).replace('"queue":"billing"', '"__proto__":{"polluted":true},"queue":"billing"')
    const r = validateSpecialistConfig(text)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(r.ok).toBe(false)
  })
})

describe("error reporting", () => {
  it("lists every problem it finds, each with a path", () => {
    const e = errorsOf(with_((c) => {
      c.scenarios[0].theme = "nope"
      c.scenarios[1].weight = 9
      c.checks.push({ field: "ghost", type: "equals" })
    }))
    expect(e.length).toBeGreaterThanOrEqual(3)
    expect(e.every((x) => typeof x.path === "string" && x.message.length > 0)).toBe(true)
  })

  it("caps the number of errors and says how many were left out", () => {
    const scenarios = Array.from({ length: 150 }, (_, i) => ({ id: `s${i}`, split: "BAD", theme: "nope", input: "", expected: {} }))
    const e = errorsOf({ ...base(), scenarios })
    expect(e.length).toBeLessThanOrEqual(LIMITS.maxErrors + 1)
    expect(e[e.length - 1].message).toMatch(/and \d+ more problems? not shown/)
  })

  it("never returns an ok result alongside errors, or partial data on failure", () => {
    const r = run(with_((c) => (c.scenarios[0].theme = "nope")))
    expect(r.ok).toBe(false)
    expect("spec" in r).toBe(false)
  })

  it("quotes and shortens a long bad value in its message", () => {
    const e = errorsOf(with_((c) => (c.scenarios[0].theme = "t".repeat(200))))
    const msg = e.find((x) => x.path === "scenarios[0].theme")!.message
    expect(msg.length).toBeLessThan(200)
  })
})
