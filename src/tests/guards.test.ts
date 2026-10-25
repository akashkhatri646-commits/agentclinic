import { describe, it, expect } from "vitest"
import {
  canDischarge,
  canAssignTherapy,
  canViewAilment,
  canBookForAilment,
  canConfirmAppointment,
  canCancelAppointment,
} from "@/lib/guards"

describe("staff-only guards", () => {
  it.each([
    ["STAFF", true],
    ["ADMIN", true],
    ["AGENT", false],
    ["", false],
    ["staff", false],
  ])("role %j -> discharge/assign/confirm = %s", (role, expected) => {
    expect(canDischarge(role)).toBe(expected)
    expect(canAssignTherapy(role)).toBe(expected)
    expect(canConfirmAppointment(role)).toBe(expected)
  })
})

describe("canViewAilment", () => {
  it("lets staff and admin view any ailment", () => {
    expect(canViewAilment("STAFF", "u1", "u2")).toBe(true)
    expect(canViewAilment("ADMIN", "u1", "u2")).toBe(true)
  })

  it("lets an agent view only their own ailment", () => {
    expect(canViewAilment("AGENT", "u1", "u1")).toBe(true)
    expect(canViewAilment("AGENT", "u1", "u2")).toBe(false)
  })

  it("denies an agent when the owner is unknown", () => {
    expect(canViewAilment("AGENT", "u1", null)).toBe(false)
    expect(canViewAilment("AGENT", "u1", undefined)).toBe(false)
  })
})

describe("canBookForAilment", () => {
  it("allows only the owning agent, even for staff and admin", () => {
    expect(canBookForAilment("u1", "u1")).toBe(true)
    expect(canBookForAilment("staff-user", "u1")).toBe(false)
  })

  it("denies when the owner is unknown", () => {
    expect(canBookForAilment("u1", null)).toBe(false)
  })
})

describe("canCancelAppointment", () => {
  it("lets staff and admin cancel any appointment", () => {
    expect(canCancelAppointment("STAFF", "s1", "a1")).toBe(true)
    expect(canCancelAppointment("ADMIN", "x", "a1")).toBe(true)
  })

  it("lets an agent cancel only their own appointment", () => {
    expect(canCancelAppointment("AGENT", "a1", "a1")).toBe(true)
    expect(canCancelAppointment("AGENT", "a1", "a2")).toBe(false)
  })

  it("denies an agent when the appointment owner is unknown", () => {
    expect(canCancelAppointment("AGENT", "a1", undefined)).toBe(false)
  })
})
