import { describe, it, expect } from "vitest"
import { isAdmin, isStaff, isAgent, canAccessAdmin } from "@/lib/roles"

describe("isAdmin", () => {
  it("returns true for ADMIN", () => expect(isAdmin("ADMIN")).toBe(true))
  it("returns false for STAFF", () => expect(isAdmin("STAFF")).toBe(false))
  it("returns false for AGENT", () => expect(isAdmin("AGENT")).toBe(false))
})

describe("isStaff", () => {
  it("returns true for STAFF", () => expect(isStaff("STAFF")).toBe(true))
  it("returns true for ADMIN", () => expect(isStaff("ADMIN")).toBe(true))
  it("returns false for AGENT", () => expect(isStaff("AGENT")).toBe(false))
})

describe("isAgent", () => {
  it("returns true for AGENT", () => expect(isAgent("AGENT")).toBe(true))
  it("returns false for STAFF", () => expect(isAgent("STAFF")).toBe(false))
  it("returns false for ADMIN", () => expect(isAgent("ADMIN")).toBe(false))
})

describe("canAccessAdmin", () => {
  it("grants access to ADMIN", () => expect(canAccessAdmin("ADMIN")).toBe(true))
  it("denies access to STAFF", () => expect(canAccessAdmin("STAFF")).toBe(false))
  it("denies access to AGENT", () => expect(canAccessAdmin("AGENT")).toBe(false))
})
