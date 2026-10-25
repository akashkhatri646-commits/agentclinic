import { describe, it, expect, vi } from "vitest"
import {
  changeFixOwner,
  changeFixStatus,
  createFix,
  normalizeDescription,
  normalizeTitle,
  updateModeInputs,
  type FixDb,
} from "../lib/evals/triage-fixes"
import { isTriageErrorCode, TRIAGE_ERROR_MESSAGES } from "../lib/evals/triage-errors"
import { FIX_STATUSES } from "../lib/evals/triage"

const at = (iso: string) => new Date(iso)

type Rec = Record<string, unknown>

function mockDb(
  opts: {
    mode?: Rec | null
    fix?: Rec | null
    users?: Record<string, Rec>
  } = {}
) {
  const failureMode = {
    findUnique: vi.fn(async () => (opts.mode === undefined ? { id: "m1", theme: "negation" } : opts.mode)),
    update: vi.fn(async () => ({})),
  }
  const fix = {
    create: vi.fn(async () => ({ id: "f-new" })),
    findUnique: vi.fn(async () => (opts.fix === undefined ? null : opts.fix)),
    update: vi.fn((args: unknown) => ({ op: "fix.update", args })),
  }
  const fixEvent = { create: vi.fn((args: unknown) => ({ op: "event.create", args })) }
  const user = {
    findUnique: vi.fn(async (args: { where: { id: string } }) => opts.users?.[args.where.id] ?? null),
  }
  const notification = { create: vi.fn(async () => ({})) }
  const $transaction = vi.fn(async (ops: unknown[]) => ops)
  const db = { failureMode, fix, fixEvent, user, notification, $transaction } as unknown as FixDb
  return { db, failureMode, fix, fixEvent, user, notification, $transaction }
}

const staff = { id: "staff-1", role: "STAFF", email: "staff@clinic.local" }
const admin = { id: "admin-1", role: "ADMIN", email: "admin@clinic.local" }
const agent = { id: "agent-1", role: "AGENT", email: "agent@clinic.local" }
const users = { "staff-1": staff, "admin-1": admin, "agent-1": agent }

const existingFix = (over: Rec = {}): Rec => ({
  id: "f1",
  status: "PROPOSED",
  ownerId: null,
  failureModeId: "m1",
  title: "Handle negation",
  isSample: false,
  failureMode: { specialistId: "intake-triage" },
  ...over,
})

describe("normalizeTitle", () => {
  it("trims and accepts 1 to 120 characters", () => {
    expect(normalizeTitle("  Handle negation  ")).toBe("Handle negation")
    expect(normalizeTitle("x")).toBe("x")
    expect(normalizeTitle("x".repeat(120))).toHaveLength(120)
  })

  it.each([[""], ["   "], ["x".repeat(121)], [null], [undefined], [42], [{}]])("rejects %j", (value) => {
    expect(normalizeTitle(value)).toBeNull()
  })
})

describe("normalizeDescription", () => {
  it("treats a missing or blank description as none", () => {
    expect(normalizeDescription(undefined)).toBeNull()
    expect(normalizeDescription(null)).toBeNull()
    expect(normalizeDescription("   ")).toBeNull()
  })

  it("trims, and accepts up to 1000 characters", () => {
    expect(normalizeDescription("  Why  ")).toBe("Why")
    expect(normalizeDescription("x".repeat(1000))).toHaveLength(1000)
  })

  it("rejects more than 1000 characters and anything that is not text", () => {
    expect(normalizeDescription("x".repeat(1001))).toBeUndefined()
    expect(normalizeDescription(5)).toBeUndefined()
  })
})

describe("createFix", () => {
  const base = { failureModeId: "m1", title: "Handle negation", actorId: "admin-1" }

  it("creates a proposed fix with its first history entry, written together", async () => {
    const m = mockDb({ users })
    const r = await createFix({ ...base, ownerId: "staff-1", description: "  Skip negated words  ", at: at("2026-09-23T10:00:00Z") }, m.db)
    expect(r).toEqual({ ok: true, value: { id: "f-new" } })
    const data = (m.fix.create.mock.calls[0] as unknown as [{ data: Rec }])[0].data
    expect(data).toMatchObject({
      failureModeId: "m1",
      title: "Handle negation",
      description: "Skip negated words",
      ownerId: "staff-1",
      status: "PROPOSED",
      createdById: "admin-1",
      isSample: false,
    })
    expect(data.createdAt).toEqual(at("2026-09-23T10:00:00Z"))
    expect(data.events).toEqual({
      create: { at: at("2026-09-23T10:00:00Z"), actorId: "admin-1", kind: "CREATED", toStatus: "PROPOSED", note: "Owner: staff@clinic.local." },
    })
  })

  it("works with no owner", async () => {
    const m = mockDb({ users })
    const r = await createFix(base, m.db)
    expect(r.ok).toBe(true)
    const data = (m.fix.create.mock.calls[0] as unknown as [{ data: Rec }])[0].data
    expect(data.ownerId).toBeNull()
    expect((data.events as { create: Rec }).create.note).toBe("No owner yet.")
    expect(m.notification.create).not.toHaveBeenCalled()
  })

  it("stores text exactly as typed: markup is not interpreted, because the page renders it as text", async () => {
    const m = mockDb({ users })
    await createFix({ ...base, title: "<script>alert(1)</script>" }, m.db)
    expect((m.fix.create.mock.calls[0] as unknown as [{ data: Rec }])[0].data.title).toBe("<script>alert(1)</script>")
  })

  it.each([
    ["an empty title", { title: "  " }, "invalid-title"],
    ["a title over 120 characters", { title: "x".repeat(121) }, "invalid-title"],
    ["a description over 1000 characters", { description: "x".repeat(1001) }, "invalid-description"],
  ] as const)("refuses %s and writes nothing", async (_name, over, code) => {
    const m = mockDb({ users })
    expect(await createFix({ ...base, ...over }, m.db)).toEqual({ ok: false, code })
    expect(m.fix.create).not.toHaveBeenCalled()
  })

  it("refuses an unknown failure mode", async () => {
    const m = mockDb({ users, mode: null })
    expect(await createFix(base, m.db)).toEqual({ ok: false, code: "not-found" })
    expect(m.fix.create).not.toHaveBeenCalled()
  })

  it.each([
    ["an agent", "agent-1"],
    ["a user that does not exist", "nobody"],
  ])("refuses %s as owner", async (_name, ownerId) => {
    const m = mockDb({ users })
    expect(await createFix({ ...base, ownerId }, m.db)).toEqual({ ok: false, code: "invalid-owner" })
    expect(m.fix.create).not.toHaveBeenCalled()
  })

  it("accepts an admin as owner", async () => {
    const m = mockDb({ users })
    expect((await createFix({ ...base, ownerId: "admin-1", actorId: "staff-1" }, m.db)).ok).toBe(true)
  })

  it("tells a different owner about the assignment, linking to the failure mode", async () => {
    const m = mockDb({ users })
    await createFix({ ...base, ownerId: "staff-1" }, m.db)
    expect(m.notification.create).toHaveBeenCalledWith({
      data: { userId: "staff-1", message: 'You were assigned a fix: "Handle negation".', href: "/dashboard/triage/m1" },
    })
  })

  it("does not tell people about assigning a fix to themselves", async () => {
    const m = mockDb({ users })
    await createFix({ ...base, ownerId: "admin-1", actorId: "admin-1" }, m.db)
    expect(m.notification.create).not.toHaveBeenCalled()
  })

  it("sends no notification for sample fixes, and flags them", async () => {
    const m = mockDb({ users })
    await createFix({ ...base, ownerId: "staff-1", isSample: true }, m.db)
    expect(m.notification.create).not.toHaveBeenCalled()
    expect((m.fix.create.mock.calls[0] as unknown as [{ data: Rec }])[0].data.isSample).toBe(true)
  })

  it("still creates the fix when the notification cannot be sent", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const m = mockDb({ users })
    m.notification.create.mockRejectedValue(new Error("db down"))
    expect((await createFix({ ...base, ownerId: "staff-1" }, m.db)).ok).toBe(true)
    spy.mockRestore()
  })
})

describe("changeFixStatus", () => {
  const base = { fixId: "f1", actorId: "staff-1" }

  it("moves a fix on and records who did it, in one transaction", async () => {
    const m = mockDb({ fix: existingFix() })
    const r = await changeFixStatus({ ...base, to: "IN_PROGRESS", at: at("2026-09-25T09:00:00Z") }, m.db)
    expect(r.ok).toBe(true)
    expect(m.fix.update).toHaveBeenCalledWith({ where: { id: "f1" }, data: { status: "IN_PROGRESS" } })
    expect(m.fixEvent.create).toHaveBeenCalledWith({
      data: { fixId: "f1", at: at("2026-09-25T09:00:00Z"), actorId: "staff-1", kind: "STATUS", fromStatus: "PROPOSED", toStatus: "IN_PROGRESS", note: null },
    })
    expect(m.$transaction).toHaveBeenCalledTimes(1)
  })

  it("needs a version to ship, and the version must exist", async () => {
    const m = mockDb({ fix: existingFix({ status: "IN_PROGRESS" }) })
    expect(await changeFixStatus({ ...base, to: "SHIPPED" }, m.db)).toEqual({ ok: false, code: "version-required" })
    expect(await changeFixStatus({ ...base, to: "SHIPPED", shippedVersion: "" }, m.db)).toEqual({ ok: false, code: "version-required" })
    expect(await changeFixStatus({ ...base, to: "SHIPPED", shippedVersion: 2 }, m.db)).toEqual({ ok: false, code: "version-required" })
    expect(await changeFixStatus({ ...base, to: "SHIPPED", shippedVersion: "v9" }, m.db)).toEqual({ ok: false, code: "invalid-version" })
    expect(m.$transaction).not.toHaveBeenCalled()
  })

  it("records the shipped version and time when shipping", async () => {
    const m = mockDb({ fix: existingFix({ status: "IN_PROGRESS" }) })
    await changeFixStatus({ ...base, to: "SHIPPED", shippedVersion: "v2", at: at("2026-10-20T09:00:00Z") }, m.db)
    expect(m.fix.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { status: "SHIPPED", shippedVersion: "v2", shippedAt: at("2026-10-20T09:00:00Z") },
    })
    expect((m.fixEvent.create.mock.calls[0] as unknown as [{ data: Rec }])[0].data.note).toBe("Shipped in v2.")
  })

  it("clears the shipped version when a shipped fix is stepped back", async () => {
    const m = mockDb({ fix: existingFix({ status: "SHIPPED" }) })
    await changeFixStatus({ ...base, to: "IN_PROGRESS" }, m.db)
    expect(m.fix.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { status: "IN_PROGRESS", shippedVersion: null, shippedAt: null },
    })
  })

  it("never lets staff set a fix to VERIFIED, from any status", async () => {
    for (const from of FIX_STATUSES) {
      const m = mockDb({ fix: existingFix({ status: from }) })
      expect(await changeFixStatus({ ...base, to: "VERIFIED" }, m.db)).toEqual({ ok: false, code: "invalid-transition" })
      expect(m.$transaction).not.toHaveBeenCalled()
    }
  })

  it("lets nothing leave VERIFIED", async () => {
    for (const to of FIX_STATUSES) {
      const m = mockDb({ fix: existingFix({ status: "VERIFIED" }) })
      expect((await changeFixStatus({ ...base, to, shippedVersion: "v2" }, m.db)).ok).toBe(false)
      expect(m.$transaction).not.toHaveBeenCalled()
    }
  })

  it.each([["DONE"], [""], [null], [3], ["PROPOSED"]])("refuses the target %j", async (to) => {
    const m = mockDb({ fix: existingFix({ status: "PROPOSED" }) }) // PROPOSED to PROPOSED is also a refusal
    expect(await changeFixStatus({ ...base, to }, m.db)).toEqual({ ok: false, code: "invalid-transition" })
  })

  it("refuses a skipped step, such as proposed straight to shipped", async () => {
    const m = mockDb({ fix: existingFix({ status: "PROPOSED" }) })
    expect(await changeFixStatus({ ...base, to: "SHIPPED", shippedVersion: "v2" }, m.db)).toEqual({ ok: false, code: "invalid-transition" })
  })

  it("refuses an unknown fix", async () => {
    const m = mockDb({ fix: null })
    expect(await changeFixStatus({ ...base, to: "IN_PROGRESS" }, m.db)).toEqual({ ok: false, code: "not-found" })
  })

  it("sends no notification for a status change", async () => {
    const m = mockDb({ fix: existingFix({ ownerId: "staff-1" }) })
    await changeFixStatus({ ...base, to: "IN_PROGRESS" }, m.db)
    expect(m.notification.create).not.toHaveBeenCalled()
  })
})

describe("changeFixOwner", () => {
  const base = { fixId: "f1", actorId: "admin-1" }

  it("sets the owner, records who did it, and tells the new owner", async () => {
    const m = mockDb({ fix: existingFix(), users })
    const r = await changeFixOwner({ ...base, ownerId: "staff-1", at: at("2026-09-25T09:00:00Z") }, m.db)
    expect(r.ok).toBe(true)
    expect(m.fix.update).toHaveBeenCalledWith({ where: { id: "f1" }, data: { ownerId: "staff-1" } })
    expect(m.fixEvent.create).toHaveBeenCalledWith({
      data: { fixId: "f1", at: at("2026-09-25T09:00:00Z"), actorId: "admin-1", kind: "OWNER", fromStatus: "PROPOSED", toStatus: "PROPOSED", note: "Owner set to staff@clinic.local." },
    })
    expect(m.notification.create).toHaveBeenCalledWith({
      data: { userId: "staff-1", message: 'You were assigned a fix: "Handle negation".', href: "/dashboard/triage/m1" },
    })
  })

  it("clears the owner without notifying anyone", async () => {
    const m = mockDb({ fix: existingFix({ ownerId: "staff-1" }), users })
    expect((await changeFixOwner({ ...base, ownerId: null }, m.db)).ok).toBe(true)
    expect(m.fix.update).toHaveBeenCalledWith({ where: { id: "f1" }, data: { ownerId: null } })
    expect(m.notification.create).not.toHaveBeenCalled()
  })

  it("refuses an agent or an unknown user as owner, and writes nothing", async () => {
    const m = mockDb({ fix: existingFix(), users })
    expect(await changeFixOwner({ ...base, ownerId: "agent-1" }, m.db)).toEqual({ ok: false, code: "invalid-owner" })
    expect(await changeFixOwner({ ...base, ownerId: "nobody" }, m.db)).toEqual({ ok: false, code: "invalid-owner" })
    expect(m.$transaction).not.toHaveBeenCalled()
  })

  it("refuses an unknown fix", async () => {
    const m = mockDb({ fix: null, users })
    expect(await changeFixOwner({ ...base, ownerId: "staff-1" }, m.db)).toEqual({ ok: false, code: "not-found" })
  })

  it("does not notify when someone assigns the fix to themselves, or re-selects the same owner", async () => {
    const self = mockDb({ fix: existingFix(), users })
    await changeFixOwner({ ...base, ownerId: "admin-1" }, self.db)
    expect(self.notification.create).not.toHaveBeenCalled()

    const same = mockDb({ fix: existingFix({ ownerId: "staff-1" }), users })
    await changeFixOwner({ ...base, ownerId: "staff-1" }, same.db)
    expect(same.notification.create).not.toHaveBeenCalled()
  })

  it("does not notify for a sample fix", async () => {
    const m = mockDb({ fix: existingFix({ isSample: true }), users })
    await changeFixOwner({ ...base, ownerId: "staff-1" }, m.db)
    expect(m.notification.create).not.toHaveBeenCalled()
  })
})

describe("updateModeInputs", () => {
  it.each([[1], [2], [3]])("accepts effort %s", async (effort) => {
    const m = mockDb()
    expect((await updateModeInputs({ failureModeId: "m1", effort }, m.db)).ok).toBe(true)
    expect(m.failureMode.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { effort } })
  })

  it.each([[0], [4], [-1], [2.5], ["2"], [null], [NaN]])("refuses effort %j without writing", async (effort) => {
    const m = mockDb()
    expect(await updateModeInputs({ failureModeId: "m1", effort }, m.db)).toEqual({ ok: false, code: "invalid-effort" })
    expect(m.failureMode.update).not.toHaveBeenCalled()
  })

  it.each([[1], [2], [3]])("accepts a severity override of %s", async (severityOverride) => {
    const m = mockDb()
    expect((await updateModeInputs({ failureModeId: "m1", severityOverride }, m.db)).ok).toBe(true)
    expect(m.failureMode.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { severityOverride } })
  })

  it("clears the override, going back to the suggestion, when given null", async () => {
    const m = mockDb()
    await updateModeInputs({ failureModeId: "m1", severityOverride: null }, m.db)
    expect(m.failureMode.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { severityOverride: null } })
  })

  it.each([[0], [4], ["3"], [1.5]])("refuses a severity override of %j without writing", async (severityOverride) => {
    const m = mockDb()
    expect(await updateModeInputs({ failureModeId: "m1", severityOverride }, m.db)).toEqual({ ok: false, code: "invalid-severity" })
    expect(m.failureMode.update).not.toHaveBeenCalled()
  })

  it("changes only the inputs it was given", async () => {
    const m = mockDb()
    await updateModeInputs({ failureModeId: "m1", effort: 3 }, m.db)
    expect(m.failureMode.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { effort: 3 } })
  })

  it("writes nothing when no input was given", async () => {
    const m = mockDb()
    expect((await updateModeInputs({ failureModeId: "m1" }, m.db)).ok).toBe(true)
    expect(m.failureMode.update).not.toHaveBeenCalled()
  })

  it("refuses an unknown failure mode", async () => {
    const m = mockDb({ mode: null })
    expect(await updateModeInputs({ failureModeId: "gone", effort: 2 }, m.db)).toEqual({ ok: false, code: "not-found" })
    expect(m.failureMode.update).not.toHaveBeenCalled()
  })
})

describe("error codes", () => {
  it("has a fixed, readable message for every code", () => {
    for (const message of Object.values(TRIAGE_ERROR_MESSAGES)) expect(message.length).toBeGreaterThan(15)
  })

  it("recognises only known codes, so arbitrary query text is never shown", () => {
    expect(isTriageErrorCode("invalid-title")).toBe(true)
    expect(isTriageErrorCode("Your session expired, call support")).toBe(false)
    expect(isTriageErrorCode("toString")).toBe(false)
    expect(isTriageErrorCode("__proto__")).toBe(false)
    expect(isTriageErrorCode(undefined)).toBe(false)
  })
})
