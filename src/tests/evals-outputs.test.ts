import { describe, it, expect, vi, beforeEach } from "vitest"
import { OUTPUTS_FORMAT, OUTPUT_LIMITS, outputsSkeleton, validateOutputs, type KnownVersion } from "../lib/evals/outputs"
import { SPEC_FORMAT, validateSpecialistConfig } from "../lib/evals/spec"
import { getTemplate, templateText } from "../lib/evals/templates"
import { runEval } from "../lib/evals/runner"
import {
  createSpecialistFromText,
  importOutputsFromText,
  updateSpecialistFromText,
  type ServiceDb,
} from "../lib/evals/specialist-service"
import { specialistRow } from "./support/specialist-rows"

vi.mock("../lib/evals/runner", () => ({ runEval: vi.fn() }))

const spec = (() => {
  const r = validateSpecialistConfig(templateText(getTemplate("classification")!))
  if (!r.ok) throw new Error("template invalid")
  return r.spec
})()

const NOW = new Date("2026-10-26T12:00:00Z")
const v1: KnownVersion = { label: "v1", releasedAt: new Date("2026-10-01T09:00:00Z") }

/** A correct outputs object for the classification template: the expected answers. */
const goodOutputs = () => Object.fromEntries(spec.scenarios.map((s) => [s.id, { category: s.expected.category }]))
const file = (over: Record<string, unknown> = {}) => ({
  format: OUTPUTS_FORMAT,
  version: "v2",
  releasedAt: "2026-10-20T09:00:00Z",
  summary: "Handles refunds.",
  outputs: goodOutputs(),
  ...over,
})
const validate = (f: unknown, known: KnownVersion[] = [v1]) =>
  validateOutputs(typeof f === "string" ? f : JSON.stringify(f), spec, known, NOW)
const errorsOf = (f: unknown, known?: KnownVersion[]) => {
  const r = validate(f, known)
  if (r.ok) throw new Error("expected the outputs to be refused")
  return r.errors
}
const has = (errors: { path: string; message: string }[], path: string, fragment: string) =>
  errors.some((e) => e.path === path && e.message.includes(fragment))

describe("validateOutputs: a valid file", () => {
  it("is accepted for a new version, with its release time and every scenario", () => {
    const r = validate(file())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.isNewVersion).toBe(true)
    expect(r.data.version).toBe("v2")
    expect(r.data.releasedAt).toEqual(new Date("2026-10-20T09:00:00Z"))
    expect(Object.keys(r.data.outputs)).toHaveLength(12)
  })

  it("accepts an existing version without a release time, and ignores one that is given", () => {
    const r = validate(file({ version: "v1", releasedAt: undefined }))
    expect(r.ok && !r.isNewVersion).toBe(true)
    expect(validate(file({ version: "v1", releasedAt: "2020-01-01T00:00:00Z" })).ok).toBe(true)
  })

  it("accepts numbers and booleans as values and turns them into text", () => {
    const outputs = goodOutputs()
    ;(outputs.d01 as Record<string, unknown>).category = 5
    ;(outputs.d02 as Record<string, unknown>).category = true
    const r = validate(file({ outputs }))
    expect(r.ok && r.data.outputs.d01.category === "5" && r.data.outputs.d02.category === "true").toBe(true)
  })

  it("accepts a first version when nothing exists yet", () => {
    expect(validate(file(), []).ok).toBe(true)
  })
})

describe("validateOutputs: the document", () => {
  it.each([[""], ["  "]])("refuses an empty file %j", (t) => expect(errorsOf(t)[0].message).toContain("empty"))
  it("refuses text that is not JSON", () => expect(errorsOf("{ nope")[0].message).toContain("not valid JSON"))
  it.each([["[]"], ["7"], ["null"]])("refuses %s because it is not an object", (t) => expect(errorsOf(t)[0].message).toContain("must be a JSON object"))
  it("refuses a file over the size limit", () => expect(errorsOf("x".repeat(OUTPUT_LIMITS.maxBytes + 1))[0].message).toContain("1024 KB"))
  it("refuses a wrong or missing format", () => {
    expect(has(errorsOf(file({ format: "other" })), "format", OUTPUTS_FORMAT)).toBe(true)
    expect(has(errorsOf(file({ format: undefined })), "format", "missing")).toBe(true)
    expect(has(errorsOf(file({ format: SPEC_FORMAT })), "format", OUTPUTS_FORMAT)).toBe(true)
  })
  it("refuses an unrecognised property", () => expect(has(errorsOf(file({ extra: 1 })), "extra", "not a recognised property")).toBe(true))
})

describe("validateOutputs: the version and its release time", () => {
  it.each([[undefined], [""], ["has space"], ["-v"], ["x".repeat(31)], [3]])("refuses the version %j", (version) => {
    expect(errorsOf(file({ version })).some((e) => e.path === "version")).toBe(true)
  })

  it.each([[undefined], [""], [null]])("needs a release time for a new version (%j)", (releasedAt) => {
    expect(has(errorsOf(file({ releasedAt })), "releasedAt", "required the first time")).toBe(true)
  })

  it.each([["tomorrow"], ["2026-13-45"], [20261020], ["10/20/2026"]])("refuses the release time %j", (releasedAt) => {
    expect(errorsOf(file({ releasedAt })).some((e) => e.path === "releasedAt")).toBe(true)
  })

  it("refuses a release time in the future", () => {
    expect(has(errorsOf(file({ releasedAt: "2026-10-27T00:00:00Z" })), "releasedAt", "future")).toBe(true)
  })

  it("accepts a release time of exactly now", () => {
    expect(validate(file({ releasedAt: NOW.toISOString() })).ok).toBe(true)
  })

  it("refuses a release time not after the latest version, naming it", () => {
    expect(has(errorsOf(file({ releasedAt: "2026-10-01T09:00:00Z" })), "releasedAt", "after the release of v1")).toBe(true)
    expect(has(errorsOf(file({ releasedAt: "2026-09-01T00:00:00Z" })), "releasedAt", "after the release of v1")).toBe(true)
  })

  it("orders against the latest version by release time, not by position in the list", () => {
    const known = [{ label: "late", releasedAt: new Date("2026-10-15T00:00:00Z") }, { label: "early", releasedAt: new Date("2026-10-01T00:00:00Z") }]
    expect(has(errorsOf(file({ releasedAt: "2026-10-10T00:00:00Z" }), known), "releasedAt", "release of late")).toBe(true)
  })

  it("refuses a summary that is too long or not text", () => {
    expect(errorsOf(file({ summary: "x".repeat(301) })).some((e) => e.path === "summary")).toBe(true)
    expect(errorsOf(file({ summary: 5 })).some((e) => e.path === "summary")).toBe(true)
  })
})

describe("validateOutputs: the outputs", () => {
  it.each([[undefined], [[]], ["x"]])("refuses %j as the outputs", (outputs) => {
    expect(has(errorsOf(file({ outputs })), "outputs", "required")).toBe(true)
  })

  it("names the scenarios that are missing, and counts them", () => {
    const outputs = goodOutputs()
    delete (outputs as Record<string, unknown>).d03
    delete (outputs as Record<string, unknown>).h04
    expect(has(errorsOf(file({ outputs })), "outputs", "missing 2 scenarios: d03, h04")).toBe(true)
  })

  it("names a scenario that does not exist", () => {
    const outputs = { ...goodOutputs(), zz9: { category: "billing" } }
    expect(has(errorsOf(file({ outputs })), "outputs.zz9", "not a scenario of this specialist")).toBe(true)
  })

  it("refuses an entry that is not an object", () => {
    expect(has(errorsOf(file({ outputs: { ...goodOutputs(), d01: "billing" } })), "outputs.d01", "must be an object")).toBe(true)
  })

  it("refuses a missing, null or structured value, and an unknown field", () => {
    expect(has(errorsOf(file({ outputs: { ...goodOutputs(), d01: {} } })), "outputs.d01.category", "missing")).toBe(true)
    expect(has(errorsOf(file({ outputs: { ...goodOutputs(), d01: { category: null } } })), "outputs.d01.category", "missing")).toBe(true)
    expect(has(errorsOf(file({ outputs: { ...goodOutputs(), d01: { category: { a: 1 } } } })), "outputs.d01.category", "text, a number")).toBe(true)
    expect(has(errorsOf(file({ outputs: { ...goodOutputs(), d01: { category: "x", mood: "y" } } })), "outputs.d01.mood", "not an output field")).toBe(true)
  })

  it("refuses a value over the length limit", () => {
    const outputs = { ...goodOutputs(), d01: { category: "x".repeat(OUTPUT_LIMITS.maxValueLength + 1) } }
    expect(has(errorsOf(file({ outputs })), "outputs.d01.category", "at most")).toBe(true)
  })

  it("does not pollute Object through a __proto__ key, and refuses it as unknown", () => {
    const text = JSON.stringify(file()).replace('"outputs":{', '"outputs":{"__proto__":{"polluted":true},')
    const r = validate(text)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(r.ok).toBe(false)
  })

  it("caps the number of errors and says how many were left out", () => {
    const outputs = Object.fromEntries(spec.scenarios.map((s) => [s.id, "bad"]))
    const e = errorsOf(file({ outputs, releasedAt: "nope", version: "no no" }))
    expect(e.length).toBeLessThanOrEqual(OUTPUT_LIMITS.maxErrors + 1)
    const withExtra = errorsOf(file({ outputs: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`zz${i}`, {}])) }))
    expect(withExtra.length).toBeLessThanOrEqual(OUTPUT_LIMITS.maxErrors + 1)
  })

  it("never returns data alongside errors", () => {
    const r = validate(file({ outputs: { ...goodOutputs(), d01: {} } }))
    expect(r.ok).toBe(false)
    expect("data" in r).toBe(false)
  })
})

describe("outputsSkeleton", () => {
  it("lists every scenario and field with empty values, and asks for a release time", () => {
    const parsed = JSON.parse(outputsSkeleton(spec, "v3"))
    expect(parsed.version).toBe("v3")
    expect(Object.keys(parsed.outputs)).toHaveLength(12)
    expect(parsed.outputs.d01).toEqual({ category: "" })
    const r = validateOutputs(outputsSkeleton(spec, "v3"), spec, [v1], NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(has(r.errors, "releasedAt", "required")).toBe(true)
  })
})

/* ───────────────────────── the services ───────────────────────── */

describe("specialist services", () => {
  const row = (ownerId = "owner-1") => specialistRow(spec, [{ label: "v1", releasedAt: v1.releasedAt }], { ownerId })
  const instanceRow = { slug: "standard-clinic", name: "Standard clinic", description: "", shape: "", referenceLists: JSON.stringify({ x: ["a"] }) }

  function fake(opts: { existing?: ReturnType<typeof row> | null; instance?: unknown } = {}) {
    const existing = opts.existing === undefined ? row() : opts.existing
    const db = {
      specialist: {
        findUnique: vi.fn(async () => existing),
        create: vi.fn(async (_args?: unknown) => ({ id: "new" })),
        update: vi.fn(async () => ({})),
      },
      specialistScenario: { deleteMany: vi.fn(async () => ({})), createMany: vi.fn(async () => ({})) },
      specialistEvent: { create: vi.fn(async () => ({})) },
      specialistVersionRow: { create: vi.fn(async () => ({ id: "ver-new" })), delete: vi.fn(async () => ({})) },
      instance: { findUnique: vi.fn(async () => (opts.instance === undefined ? instanceRow : opts.instance)) },
      therapy: { findMany: vi.fn(async () => []) },
      evalRun: { count: vi.fn(async () => 0) },
      $transaction: vi.fn(async (ops: unknown[]) => ops),
    }
    return { db: db as unknown as ServiceDb, raw: db }
  }
  const owner = { id: "owner-1", role: "STAFF" }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(runEval).mockResolvedValue({ id: "run-1", verdict: "PASS" } as never)
  })

  describe("createSpecialistFromText", () => {
    const config = templateText(getTemplate("classification")!)

    it("creates for staff and admin, owned by the caller", async () => {
      for (const role of ["STAFF", "ADMIN"]) {
        const { db, raw } = fake({ existing: null })
        const r = await createSpecialistFromText({ actor: { id: "u1", role }, text: config, db })
        expect(r).toEqual({ ok: true, slug: "my-classifier" })
        expect((raw.specialist.create.mock.calls[0][0] as { data: { ownerId: string } }).data.ownerId).toBe("u1")
      }
    })

    it.each([["AGENT"], [""], ["staff"]])("refuses role %j without reading the config", async (role) => {
      const { db, raw } = fake({ existing: null })
      expect(await createSpecialistFromText({ actor: { id: "u1", role }, text: config, db })).toEqual({ ok: false, code: "forbidden" })
      expect(raw.specialist.create).not.toHaveBeenCalled()
    })

    it("returns every validation problem and saves nothing", async () => {
      const { db, raw } = fake({ existing: null })
      const r = await createSpecialistFromText({ actor: owner, text: "{}", db })
      expect(r.ok).toBe(false)
      if (!r.ok && r.code === "invalid") expect(r.errors.length).toBeGreaterThan(1)
      expect(raw.specialist.create).not.toHaveBeenCalled()
    })

    it("reports a slug that is taken", async () => {
      expect(await createSpecialistFromText({ actor: owner, text: config, db: fake().db })).toEqual({ ok: false, code: "slug-taken" })
    })

    it("reports a database failure as failed, without throwing", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      const { db, raw } = fake({ existing: null })
      raw.specialist.create.mockRejectedValueOnce(new Error("disk"))
      expect(await createSpecialistFromText({ actor: owner, text: config, db })).toEqual({ ok: false, code: "failed" })
      spy.mockRestore()
    })
  })

  describe("updateSpecialistFromText", () => {
    const grown = () => JSON.stringify({ ...JSON.parse(templateText(getTemplate("classification")!)), slug: spec.slug, name: "Renamed" })

    it("lets the owner and an admin change it, and refuses another staff member", async () => {
      expect((await updateSpecialistFromText({ actor: owner, slug: spec.slug, text: grown(), db: fake().db })).ok).toBe(true)
      expect((await updateSpecialistFromText({ actor: { id: "x", role: "ADMIN" }, slug: spec.slug, text: grown(), db: fake().db })).ok).toBe(true)
      const { db, raw } = fake()
      expect(await updateSpecialistFromText({ actor: { id: "other", role: "STAFF" }, slug: spec.slug, text: grown(), db })).toEqual({ ok: false, code: "forbidden" })
      expect(raw.$transaction).not.toHaveBeenCalled()
    })

    it("refuses an agent even if they own it", async () => {
      const { db } = fake({ existing: row("agent-1") })
      expect(await updateSpecialistFromText({ actor: { id: "agent-1", role: "AGENT" }, slug: spec.slug, text: grown(), db })).toEqual({ ok: false, code: "forbidden" })
    })

    it("reports an unknown specialist", async () => {
      expect(await updateSpecialistFromText({ actor: owner, slug: "x", text: grown(), db: fake({ existing: null }).db })).toEqual({ ok: false, code: "not-found" })
    })

    it("reports validation problems and definition-change refusals as invalid", async () => {
      expect((await updateSpecialistFromText({ actor: owner, slug: spec.slug, text: "{", db: fake().db })).ok).toBe(false)
      const { db, raw } = fake()
      raw.evalRun.count.mockResolvedValue(3)
      const text = JSON.stringify({ ...JSON.parse(grown()), scenarios: JSON.parse(grown()).scenarios.slice(1) })
      const r = await updateSpecialistFromText({ actor: owner, slug: spec.slug, text, db })
      expect(r.ok).toBe(false)
      if (!r.ok && r.code === "invalid") expect(r.errors[0].message).toContain("d01")
    })
  })

  describe("importOutputsFromText", () => {
    const run = (over: Partial<Parameters<typeof importOutputsFromText>[0]> = {}, f: unknown = file()) =>
      importOutputsFromText({ actor: owner, slug: spec.slug, instance: "standard-clinic", text: JSON.stringify(f), now: NOW, ...over })

    it("registers a new version with its release time, runs the outputs on the instance, and records the event", async () => {
      const { db, raw } = fake()
      const r = await run({ db })
      expect(r).toEqual({ ok: true, runId: "run-1", verdict: "PASS", newVersion: true })
      expect(raw.specialistVersionRow.create).toHaveBeenCalledWith({
        data: { specialistId: "sp-my-classifier", label: "v2", summary: "Handles refunds.", releasedAt: new Date("2026-10-20T09:00:00Z") },
        select: { id: true },
      })
      const call = vi.mocked(runEval).mock.calls[0][0]
      expect(call).toMatchObject({ specialistId: spec.slug, version: "v2", instance: "standard-clinic", triggeredBy: "owner-1" })
      expect(Object.keys(call.outputs ?? {})).toHaveLength(12)
      expect(raw.specialistEvent.create).toHaveBeenCalledWith({ data: { specialistId: "sp-my-classifier", type: "OUTPUTS_IMPORTED", actorId: "owner-1", actorRole: "STAFF" } })
    })

    it("adds another run to an existing version without registering it again", async () => {
      const { db, raw } = fake()
      const r = await run({ db }, file({ version: "v1", releasedAt: undefined }))
      expect(r).toMatchObject({ ok: true, newVersion: false })
      expect(raw.specialistVersionRow.create).not.toHaveBeenCalled()
    })

    it("refuses someone who does not own it, and does nothing", async () => {
      const { db, raw } = fake()
      expect(await run({ db, actor: { id: "other", role: "STAFF" } })).toEqual({ ok: false, code: "forbidden" })
      expect(raw.specialistVersionRow.create).not.toHaveBeenCalled()
      expect(runEval).not.toHaveBeenCalled()
    })

    it("lets an admin import for a specialist they do not own", async () => {
      expect((await run({ db: fake().db, actor: { id: "admin-9", role: "ADMIN" } })).ok).toBe(true)
    })

    it("refuses an unknown specialist and an unknown instance", async () => {
      expect(await run({ db: fake({ existing: null }).db })).toEqual({ ok: false, code: "not-found" })
      expect(await run({ db: fake({ instance: null }).db })).toEqual({ ok: false, code: "unknown-instance" })
    })

    it("returns the validation problems and registers nothing for a bad file", async () => {
      const { db, raw } = fake()
      const r = await run({ db }, file({ releasedAt: "2020-01-01T00:00:00Z" }))
      expect(r.ok).toBe(false)
      if (!r.ok && r.code === "invalid") expect(r.errors[0].path).toBe("releasedAt")
      expect(raw.specialistVersionRow.create).not.toHaveBeenCalled()
      expect(runEval).not.toHaveBeenCalled()
    })

    it("refuses to import over a version that runs from code", async () => {
      const builtin = specialistRow(spec, [{ label: "v1", releasedAt: v1.releasedAt, builtinKey: "x/v1" }], { ownerId: "owner-1" })
      const r = await run({ db: fake({ existing: builtin }).db }, file({ version: "v1" }))
      expect(r.ok).toBe(false)
      if (!r.ok && r.code === "invalid") expect(r.errors[0].message).toContain("runs from code")
    })

    it("removes the version it registered when the run fails, and reports failure", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(runEval).mockRejectedValueOnce(new Error("boom"))
      const { db, raw } = fake()
      expect(await run({ db })).toEqual({ ok: false, code: "failed" })
      expect(raw.specialistVersionRow.delete).toHaveBeenCalledWith({ where: { id: "ver-new" } })
      spy.mockRestore()
    })

    it("does not remove an existing version when its run fails", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(runEval).mockRejectedValueOnce(new Error("boom"))
      const { db, raw } = fake()
      await run({ db }, file({ version: "v1", releasedAt: undefined }))
      expect(raw.specialistVersionRow.delete).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it("still succeeds when the event cannot be recorded", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      const { db, raw } = fake()
      raw.specialistEvent.create.mockRejectedValue(new Error("x"))
      expect((await run({ db })).ok).toBe(true)
      spy.mockRestore()
    })
  })
})
