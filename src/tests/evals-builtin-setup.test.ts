import { describe, it, expect, vi } from "vitest"
import { ensureBuiltins, type SetupDb } from "../lib/evals/builtin-setup"
import { SEEDED_INSTANCES } from "../lib/evals/instances"
import { BUILTIN_VERSIONS } from "../lib/evals/builtin"

/** An in-memory stand-in with just the tables the setup touches. */
function fake(opts: { users?: { id: string; role: string }[]; instances?: string[]; specialist?: boolean; versions?: string[]; earliestRun?: Date | null } = {}) {
  const instances = new Set(opts.instances ?? [])
  const versions = new Set(opts.versions ?? [])
  const state = { specialist: opts.specialist ?? false, createdWith: null as unknown }
  const db = {
    instance: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => (instances.has(where.slug) ? { id: where.slug } : null)),
      create: vi.fn(async ({ data }: { data: { slug: string } }) => { instances.add(data.slug); return {} }),
    },
    specialist: {
      findUnique: vi.fn(async () => (state.specialist ? { id: "sp1" } : null)),
      create: vi.fn(async (args: unknown) => { state.specialist = true; state.createdWith = args; return { id: "sp1" } }),
    },
    specialistVersionRow: {
      findFirst: vi.fn(async ({ where }: { where: { label: string } }) => (versions.has(where.label) ? { id: where.label } : null)),
      create: vi.fn(async ({ data }: { data: { label: string } }) => { versions.add(data.label); return {} }),
    },
    specialistEvent: { create: vi.fn() },
    evalRun: { findFirst: vi.fn(async () => (opts.earliestRun === undefined ? null : opts.earliestRun === null ? null : { createdAt: opts.earliestRun })) },
    user: {
      findFirst: vi.fn(async ({ where }: { where?: { role?: string } } = {}) => {
        const users = opts.users ?? [{ id: "u1", role: "STAFF" }, { id: "admin1", role: "ADMIN" }]
        return users.find((u) => !where?.role || u.role === where.role) ?? null
      }),
    },
  } as unknown as SetupDb
  return { db, instances, versions, state }
}
const raw = (db: SetupDb) => db as unknown as { specialist: { create: ReturnType<typeof vi.fn> }; specialistVersionRow: { create: ReturnType<typeof vi.fn> }; instance: { create: ReturnType<typeof vi.fn> } }

describe("ensureBuiltins", () => {
  it("adds the instances, the built-in specialist and its code versions to a database that has none", async () => {
    const f = fake()
    expect(await ensureBuiltins(f.db)).toEqual({ instancesCreated: SEEDED_INSTANCES.length, specialist: "created", versionsCreated: BUILTIN_VERSIONS.length })
    expect(Array.from(f.versions).sort()).toEqual(["v1", "v2"])
  })

  it("owns the specialist by the first admin, falling back to the first user", async () => {
    const withAdmin = fake()
    await ensureBuiltins(withAdmin.db)
    expect((raw(withAdmin.db).specialist.create.mock.calls[0][0] as { data: { ownerId: string } }).data.ownerId).toBe("admin1")
    const noAdmin = fake({ users: [{ id: "u1", role: "STAFF" }] })
    await ensureBuiltins(noAdmin.db)
    expect((raw(noAdmin.db).specialist.create.mock.calls[0][0] as { data: { ownerId: string } }).data.ownerId).toBe("u1")
  })

  it("dates the specialist from its earliest existing run", async () => {
    const f = fake({ earliestRun: new Date("2026-09-22T09:05:00Z") })
    await ensureBuiltins(f.db)
    expect((raw(f.db).specialist.create.mock.calls[0][0] as { data: { createdAt: Date } }).data.createdAt).toEqual(new Date("2026-09-22T09:05:00Z"))
  })

  it("registers the versions as running from code, with their release times", async () => {
    const f = fake()
    await ensureBuiltins(f.db)
    const data = raw(f.db).specialistVersionRow.create.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data)
    expect(data.map((d) => d.builtinKey)).toEqual(["intake-triage/v1", "intake-triage/v2"])
    expect(data.every((d) => d.releasedAt instanceof Date)).toBe(true)
  })

  it("does nothing, and creates nothing, when everything is already there", async () => {
    const f = fake({ instances: SEEDED_INSTANCES.map((i) => i.slug), specialist: true, versions: ["v1", "v2"] })
    expect(await ensureBuiltins(f.db)).toEqual({ instancesCreated: 0, specialist: "present", versionsCreated: 0 })
    expect(raw(f.db).instance.create).not.toHaveBeenCalled()
    expect(raw(f.db).specialist.create).not.toHaveBeenCalled()
    expect(raw(f.db).specialistVersionRow.create).not.toHaveBeenCalled()
  })

  it("is safe to run twice", async () => {
    const f = fake()
    await ensureBuiltins(f.db)
    expect(await ensureBuiltins(f.db)).toEqual({ instancesCreated: 0, specialist: "present", versionsCreated: 0 })
  })

  it("adds only what is missing", async () => {
    const f = fake({ instances: ["standard-clinic"], specialist: true, versions: ["v1"] })
    expect(await ensureBuiltins(f.db)).toEqual({ instancesCreated: SEEDED_INSTANCES.length - 1, specialist: "present", versionsCreated: 1 })
  })

  it("says so, and creates nothing, when there is no one to own the specialist", async () => {
    const f = fake({ users: [] })
    await expect(ensureBuiltins(f.db)).rejects.toThrow("no users")
    expect(raw(f.db).specialist.create).not.toHaveBeenCalled()
  })
})
