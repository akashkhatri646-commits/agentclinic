import { describe, it, expect, vi } from "vitest"
import { TEMPLATES, getTemplate, templateText } from "../lib/evals/templates"
import { SEEDED_INSTANCES, STANDARD_INSTANCE, listInstances, parseReferenceLists, resolveInstance, type InstanceDb } from "../lib/evals/instances"
import { BUILTIN_VERSIONS, builtinKey, getBuiltinRunner } from "../lib/evals/builtin"
import { checkDefinitionChange, createSpecialist, listSpecialists, loadSpecialist, rowToSpec, updateSpecialist, type StoreDb } from "../lib/evals/specialist-store"
import { intakeTriageSpec } from "../lib/evals/builtin-spec"
import { SEEDED_THERAPY_NAMES, THERAPY } from "../lib/evals/catalogue"
import { validateSpecialistConfig, type SpecialistSpec } from "../lib/evals/spec"

const specOf = (id: string): SpecialistSpec => {
  const r = validateSpecialistConfig(templateText(getTemplate(id)!))
  if (!r.ok) throw new Error("template invalid")
  return r.spec
}

describe("templates", () => {
  it("offers the three templates", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["intake-triage", "classification", "blank"])
  })

  it.each(TEMPLATES.map((t) => [t.id]))("the %s template is valid as it stands", (id) => {
    const r = validateSpecialistConfig(templateText(getTemplate(id)!))
    expect(r.ok).toBe(true)
  })

  it("the worked example carries all 32 scenarios, 10 themes and the judge", () => {
    const s = specOf("intake-triage")
    expect([s.scenarios.length, s.themes.length, s.judge?.field]).toEqual([32, 10, "rationale"])
  })

  it("the classification starter has a hold-out set and two themes", () => {
    const s = specOf("classification")
    expect(s.scenarios).toHaveLength(12)
    expect(s.scenarios.filter((x) => x.split === "HOLDOUT").length).toBeGreaterThan(0)
    expect(s.themes).toHaveLength(2)
  })

  it("the blank starter is the minimum: one field, check, theme and scenario", () => {
    const s = specOf("blank")
    expect([s.outputFields.length, s.checks.length, s.themes.length, s.scenarios.length]).toEqual([1, 1, 1, 1])
  })

  it("no template uses a slug the app reserves, and none collides with the built-in specialist", () => {
    for (const t of TEMPLATES) expect(specOf(t.id).slug).not.toBe("intake-triage")
  })

  it("returns null for an unknown template", () => {
    expect(getTemplate("nope")).toBeNull()
  })
})

describe("instances", () => {
  const db = (rows: unknown[], therapies = ["A", "B"]) =>
    ({
      instance: { findMany: vi.fn(async () => rows), findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => (rows as { slug: string }[]).find((r) => r.slug === where.slug) ?? null) },
      therapy: { findMany: vi.fn(async () => therapies.map((name) => ({ name }))) },
    }) as unknown as InstanceDb

  it("seeds three instances, the standard clinic reading the live catalogue", () => {
    expect(SEEDED_INSTANCES.map((i) => i.slug)).toEqual([STANDARD_INSTANCE, "short-staffed-clinic", "regional-catalogue"])
    expect(SEEDED_INSTANCES[0].referenceLists).toBeNull()
  })

  it("the short-staffed clinic lacks exactly one therapy and the regional one renames some", () => {
    const short = SEEDED_INSTANCES[1].referenceLists!.therapies
    expect(SEEDED_THERAPY_NAMES.filter((n) => !short.includes(n))).toEqual([THERAPY.EXPECTATION_RECALIBRATION])
    const regional = SEEDED_INSTANCES[2].referenceLists!.therapies
    expect(regional).toHaveLength(5)
    expect(SEEDED_THERAPY_NAMES.filter((n) => !regional.includes(n)).length).toBeGreaterThan(0)
  })

  it("resolves the standard clinic from the live catalogue", async () => {
    const d = db([{ slug: STANDARD_INSTANCE, name: "Standard", referenceLists: null }], ["X", "Y", "Z"])
    expect(await resolveInstance(d, STANDARD_INSTANCE)).toEqual({ slug: STANDARD_INSTANCE, name: "Standard", lists: { therapies: ["X", "Y", "Z"] } })
  })

  it("resolves a fixed instance from its stored lists without touching the catalogue", async () => {
    const d = db([{ slug: "fixed", name: "Fixed", referenceLists: JSON.stringify({ therapies: ["Only"] }) }])
    expect((await resolveInstance(d, "fixed"))!.lists).toEqual({ therapies: ["Only"] })
    expect((d.therapy.findMany as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it("returns null for an unknown instance", async () => {
    expect(await resolveInstance(db([]), "ghost")).toBeNull()
  })

  it("lists the standard clinic first", async () => {
    const rows = [{ slug: "b" }, { slug: STANDARD_INSTANCE }, { slug: "c" }]
    expect((await listInstances(db(rows))).map((r) => r.slug)).toEqual([STANDARD_INSTANCE, "b", "c"])
  })

  it("keeps a stored __proto__ key as a plain entry instead of changing the lists' prototype", () => {
    const lists = parseReferenceLists('{"__proto__":["x"],"therapies":["a"]}')!
    expect(Object.getPrototypeOf(lists)).toBe(Object.prototype)
    expect(Object.keys(lists).sort()).toEqual(["__proto__", "therapies"])
    expect(lists.therapies).toEqual(["a"])
  })

  it.each([[null, null], ["", null], ["not json", {}], ["[1]", {}], ['"x"', {}], ['{"a":["x",1,"y"],"b":"no"}', { a: ["x", "y"] }]])(
    "reads stored lists %j as %j",
    (text, expected) => {
      expect(parseReferenceLists(text as string | null)).toEqual(expected)
    }
  )
})

describe("built-in versions", () => {
  it("registers v1 and v2 of intake-triage with release times", () => {
    expect(BUILTIN_VERSIONS.map((v) => v.key)).toEqual(["intake-triage/v1", "intake-triage/v2"])
    expect(BUILTIN_VERSIONS[0].releasedAt.getTime()).toBeLessThan(BUILTIN_VERSIONS[1].releasedAt.getTime())
  })

  it("produces generic outputs from a built-in key and returns null for others", () => {
    const run = getBuiltinRunner(builtinKey("intake-triage", "v2"))!
    const out = run("Constant panic and cannot stop looping on the same prompt", { therapies: SEEDED_THERAPY_NAMES })
    expect(Object.keys(out).sort()).toEqual(["rationale", "severity", "therapy"])
    expect(getBuiltinRunner("intake-triage/v9")).toBeNull()
    expect(getBuiltinRunner(null)).toBeNull()
  })

  it("matches the generic spec fields", () => {
    const run = getBuiltinRunner("intake-triage/v1")!
    expect(Object.keys(run("anything", { therapies: [] })).sort()).toEqual(intakeTriageSpec.outputFields.map((f) => f.name).sort())
  })
})

describe("stored specialists", () => {
  const spec = specOf("classification")

  function rowFrom(s: SpecialistSpec, over: Record<string, unknown> = {}) {
    return {
      id: "sp1", slug: s.slug, name: s.name, description: s.description, ownerId: "u1",
      outputFields: JSON.stringify(s.outputFields), checks: JSON.stringify(s.checks), themes: JSON.stringify(s.themes),
      judgeField: s.judge?.field ?? null, isSample: false, createdAt: new Date("2026-10-01T00:00:00Z"),
      scenarios: s.scenarios.map((x, position) => ({ key: x.id, split: x.split, theme: x.theme, weight: x.weight, input: x.input, expected: JSON.stringify(x.expected), why: x.why, position })).reverse(),
      versions: [{ label: "v1", summary: "", releasedAt: new Date("2026-10-02T00:00:00Z"), builtinKey: null }],
      ...over,
    }
  }

  function makeDb(row: ReturnType<typeof rowFrom> | null, runs = 0) {
    const calls: string[] = []
    const db = {
      specialist: {
        findUnique: vi.fn(async () => row),
        findMany: vi.fn(async () => (row ? [{ ...row, owner: { email: "o@x.y" }, _count: { scenarios: row.scenarios.length, versions: row.versions.length } }] : [])),
        create: vi.fn(async (a: unknown) => { calls.push("create"); return { id: "new", ...(a as object) } }),
        update: vi.fn(async () => { calls.push("update") }),
      },
      specialistScenario: { deleteMany: vi.fn(async () => { calls.push("deleteMany") }), createMany: vi.fn(async () => { calls.push("createMany") }) },
      specialistEvent: { create: vi.fn(async () => { calls.push("event") }) },
      evalRun: { count: vi.fn(async () => runs) },
      $transaction: vi.fn(async (ops: unknown[]) => { await Promise.all(ops); return [] }),
    }
    return { db: db as unknown as StoreDb, raw: db, calls }
  }

  it("rebuilds a spec from a stored row in scenario order, whatever order the rows come back in", () => {
    const rebuilt = rowToSpec(rowFrom(spec))
    expect(rebuilt).toEqual(spec)
    expect(rebuilt.scenarios[0].id).toBe("d01")
  })

  it("reads back a definition larger than the limit for submitted text (defaults are added on the way back)", () => {
    const long = { ...spec, scenarios: spec.scenarios.map((x) => ({ ...x, input: "word ".repeat(400) })) }
    const many = { ...long, scenarios: Array.from({ length: 12 }, () => long.scenarios).flat().map((x, i) => ({ ...x, id: `s${i}` })) }
    expect(JSON.stringify(many).length).toBeGreaterThan(200 * 1024)
    expect(rowToSpec(rowFrom(many)).scenarios).toHaveLength(144)
  })

  it("reports a damaged row instead of trusting it", () => {
    expect(() => rowToSpec(rowFrom(spec, { checks: "{broken" }))).toThrow(/damaged/)
    expect(() => rowToSpec(rowFrom(spec, { themes: "[]" }))).toThrow(/damaged/)
  })

  it("loads a specialist with its versions, or null", async () => {
    const loaded = await loadSpecialist(makeDb(rowFrom(spec)).db, spec.slug)
    expect(loaded!.spec.slug).toBe(spec.slug)
    expect(loaded!.versions.map((v) => v.label)).toEqual(["v1"])
    expect(await loadSpecialist(makeDb(null).db, "x")).toBeNull()
  })

  it("summarises specialists with owner and counts", async () => {
    const [s] = await listSpecialists(makeDb(rowFrom(spec)).db)
    expect(s).toMatchObject({ slug: spec.slug, ownerEmail: "o@x.y", scenarioCount: 12, versionCount: 1 })
  })

  describe("create", () => {
    it("creates the specialist with its scenarios and a CREATED event for the owner", async () => {
      const { db, raw } = makeDb(null)
      const r = await createSpecialist({ db, spec, ownerId: "u9", actorRole: "STAFF" })
      expect(r).toEqual({ ok: true, id: "new" })
      const data = (raw.specialist.create.mock.calls[0][0] as { data: Record<string, any> }).data
      expect(data.ownerId).toBe("u9")
      expect(data.scenarios.create).toHaveLength(12)
      expect(data.events.create).toMatchObject({ type: "CREATED", actorId: "u9", actorRole: "STAFF" })
      expect(JSON.parse(data.checks)).toEqual(spec.checks)
    })

    it("refuses a slug that is taken, without creating anything", async () => {
      const { db, raw } = makeDb(rowFrom(spec))
      expect(await createSpecialist({ db, spec, ownerId: "u1", actorRole: "STAFF" })).toEqual({ ok: false, code: "SLUG_TAKEN" })
      expect(raw.specialist.create).not.toHaveBeenCalled()
    })

    it("treats a unique-index race as a taken slug", async () => {
      const { db, raw } = makeDb(null)
      raw.specialist.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }))
      expect(await createSpecialist({ db, spec, ownerId: "u1", actorRole: "STAFF" })).toEqual({ ok: false, code: "SLUG_TAKEN" })
    })

    it("lets other database errors through", async () => {
      const { db, raw } = makeDb(null)
      raw.specialist.create.mockRejectedValueOnce(new Error("disk full"))
      await expect(createSpecialist({ db, spec, ownerId: "u1", actorRole: "STAFF" })).rejects.toThrow("disk full")
    })

    it("marks sample specialists and their event as sample", async () => {
      const { db, raw } = makeDb(null)
      await createSpecialist({ db, spec, ownerId: "u1", actorRole: "STAFF", isSample: true })
      const data = (raw.specialist.create.mock.calls[0][0] as { data: Record<string, any> }).data
      expect([data.isSample, data.events.create.isSample]).toEqual([true, true])
    })
  })

  describe("definition changes", () => {
    const grow = (): SpecialistSpec => ({ ...spec, scenarios: [...spec.scenarios, { ...spec.scenarios[0], id: "d99" }] })

    it("allows anything but a new slug before the first run", () => {
      const fewer = { ...spec, scenarios: spec.scenarios.slice(0, 4) }
      expect(checkDefinitionChange(spec, fewer, false)).toEqual([])
      expect(checkDefinitionChange(spec, { ...spec, slug: "other" }, false)[0].path).toBe("slug")
    })

    it("after runs, allows adding and rewording", () => {
      const reworded = { ...grow(), name: "Renamed", themes: [...spec.themes, { id: "new", label: "New", description: "" }] }
      expect(checkDefinitionChange(spec, reworded, true)).toEqual([])
    })

    it.each([
      ["a removed scenario", (s: SpecialistSpec) => ({ ...s, scenarios: s.scenarios.slice(1) }), 'scenario "d01"'],
      ["a renamed scenario id", (s: SpecialistSpec) => ({ ...s, scenarios: s.scenarios.map((x) => (x.id === "d01" ? { ...x, id: "z01" } : x)) }), 'scenario "d01"'],
      ["a removed theme", (s: SpecialistSpec) => ({ ...s, themes: s.themes.slice(1), scenarios: s.scenarios.map((x) => ({ ...x, theme: s.themes[1].id })) }), 'theme "clear-cases"'],
      ["a changed check", (s: SpecialistSpec) => ({ ...s, checks: [{ field: "category", type: "nonEmpty" as const }] }), "check"],
      ["a removed field", (s: SpecialistSpec) => ({ ...s, outputFields: [{ name: "other", description: "" }], checks: [{ field: "other", type: "equals" as const }], scenarios: s.scenarios.map((x) => ({ ...x, expected: { other: "a" } })) }), 'output field "category"'],
      ["a moved split", (s: SpecialistSpec) => ({ ...s, scenarios: s.scenarios.map((x) => (x.id === "d01" ? { ...x, split: "HOLDOUT" as const } : x)) }), "moved from DEV to HOLDOUT"],
      ["a changed theme", (s: SpecialistSpec) => ({ ...s, scenarios: s.scenarios.map((x) => (x.id === "d01" ? { ...x, theme: "edge-cases" } : x)) }), "changed theme"],
    ])("after runs, refuses %s, naming it", (_name, edit, fragment) => {
      const errors = checkDefinitionChange(spec, edit(spec), true)
      expect(errors.some((e) => e.message.includes(fragment))).toBe(true)
    })

    it("updates by replacing scenarios and recording an UPDATED event", async () => {
      const { db, calls } = makeDb(rowFrom(spec), 1)
      const r = await updateSpecialist({ db, slug: spec.slug, spec: grow(), actorId: "u1", actorRole: "STAFF" })
      expect(r).toEqual({ ok: true, changed: true })
      expect(calls).toEqual(["update", "deleteMany", "createMany", "event"])
    })

    it("does nothing, and records nothing, when the config is unchanged", async () => {
      const { db, calls } = makeDb(rowFrom(spec), 1)
      expect(await updateSpecialist({ db, slug: spec.slug, spec, actorId: "u1", actorRole: "STAFF" })).toEqual({ ok: true, changed: false })
      expect(calls).toEqual([])
    })

    it("refuses a destructive change once there are runs, and writes nothing", async () => {
      const { db, calls } = makeDb(rowFrom(spec), 2)
      const r = await updateSpecialist({ db, slug: spec.slug, spec: { ...spec, scenarios: spec.scenarios.slice(1) }, actorId: "u1", actorRole: "STAFF" })
      expect(r.ok).toBe(false)
      if (!r.ok && r.code === "INVALID") expect(r.errors[0].message).toContain("d01")
      expect(calls).toEqual([])
    })

    it("allows the same destructive change when there are no runs", async () => {
      const { db } = makeDb(rowFrom(spec), 0)
      const r = await updateSpecialist({ db, slug: spec.slug, spec: { ...spec, scenarios: spec.scenarios.slice(0, 6) }, actorId: "u1", actorRole: "STAFF" })
      expect(r).toEqual({ ok: true, changed: true })
    })

    it("reports an unknown specialist", async () => {
      expect(await updateSpecialist({ db: makeDb(null).db, slug: "x", spec, actorId: "u", actorRole: "STAFF" })).toEqual({ ok: false, code: "NOT_FOUND" })
    })

    it("refuses to change the slug", async () => {
      const { db } = makeDb(rowFrom(spec))
      const r = await updateSpecialist({ db, slug: spec.slug, spec: { ...spec, slug: "other" }, actorId: "u", actorRole: "STAFF" })
      expect(r.ok).toBe(false)
    })
  })
})
