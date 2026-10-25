import { describe, it, expect } from "vitest"
import { formatDateTimeUtc, formatDateUtc } from "../lib/evals/format"

describe("UTC date formatting", () => {
  it("formats a date in UTC regardless of the local time zone", () => {
    // 23:30 UTC is already the next day in some zones; it must still read as the 22nd.
    expect(formatDateUtc(new Date("2026-10-22T23:30:00Z"))).toBe("22 Oct 2026")
  })

  it("includes the time, in UTC", () => {
    expect(formatDateTimeUtc(new Date("2026-10-22T09:04:00Z"))).toBe("22 Oct 2026, 09:04")
  })

  it("says unknown for a missing date", () => {
    expect(formatDateUtc(null)).toBe("unknown")
    expect(formatDateUtc(undefined)).toBe("unknown")
    expect(formatDateTimeUtc(null)).toBe("unknown")
  })
})
