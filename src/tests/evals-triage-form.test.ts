import { describe, it, expect } from "vitest"
import { parseEffort, parseOwner, parseSeverityOverride, safeModeId, triageRedirect } from "../lib/evals/triage-form"

describe("parseEffort", () => {
  it("reads a number from text", () => {
    expect(parseEffort("1")).toBe(1)
    expect(parseEffort("3")).toBe(3)
  })

  it.each([[undefined], [null], [""], ["   "]])("treats %j as not provided", (v) => {
    expect(parseEffort(v)).toBeUndefined()
  })

  it("passes bad values on as numbers the service will refuse", () => {
    expect(parseEffort("abc")).toBeNaN()
    expect(parseEffort("2.5")).toBe(2.5)
    expect(parseEffort("99")).toBe(99)
  })

  it("does not accept a non-text value such as an uploaded file", () => {
    expect(parseEffort({ name: "x" })).toBeUndefined()
    expect(parseEffort(3)).toBeUndefined()
  })
})

describe("parseSeverityOverride", () => {
  it("treats 'auto' as clearing the override", () => expect(parseSeverityOverride("auto")).toBeNull())
  it("reads a number", () => expect(parseSeverityOverride("2")).toBe(2))
  it.each([[undefined], [""], ["  "]])("treats %j as not provided", (v) => {
    expect(parseSeverityOverride(v)).toBeUndefined()
  })
  it("passes bad values on for the service to refuse", () => {
    expect(parseSeverityOverride("high")).toBeNaN()
    expect(parseSeverityOverride("7")).toBe(7)
  })
})

describe("parseOwner", () => {
  it("returns the id, trimmed", () => expect(parseOwner("  abc  ")).toBe("abc"))
  it.each([[""], ["   "], [undefined], [null], [42]])("returns no owner for %j", (v) => {
    expect(parseOwner(v)).toBeNull()
  })
})

describe("safeModeId", () => {
  it("accepts ordinary ids", () => {
    expect(safeModeId("cmvo1b1h2000s123r8kflgfzn")).toBe("cmvo1b1h2000s123r8kflgfzn")
    expect(safeModeId("a-b_C9")).toBe("a-b_C9")
  })

  it.each([
    ["../../evil"],
    ["https://evil.example"],
    ["//evil.example"],
    ["a/b"],
    ["a?b=c"],
    ["a b"],
    ["a\nb"],
    [""],
    ["x".repeat(65)],
    [undefined],
    [null],
    [5],
  ])("rejects %j so a forged field cannot redirect elsewhere", (v) => {
    expect(safeModeId(v)).toBeNull()
  })
})

describe("triageRedirect", () => {
  it("goes to the failure mode's page, or the backlog when there is no valid id", () => {
    expect(triageRedirect("abc")).toBe("/dashboard/triage/abc")
    expect(triageRedirect(null)).toBe("/dashboard/triage")
  })

  it("adds an error code, encoded", () => {
    expect(triageRedirect("abc", "invalid-title")).toBe("/dashboard/triage/abc?error=invalid-title")
    expect(triageRedirect(null, "a b&c")).toBe("/dashboard/triage?error=a%20b%26c")
  })
})
