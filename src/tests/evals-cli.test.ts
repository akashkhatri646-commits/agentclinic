import { describe, it, expect } from "vitest"
import { describeJudge, formatRunReport, parseEvalArgs } from "../lib/evals/cli"

describe("parseEvalArgs", () => {
  it("defaults to all versions with no judge", () => {
    expect(parseEvalArgs([])).toEqual({ ok: true, specialist: null, instance: null, versions: null, judge: false, help: false })
  })

  it("accepts --specialist and --instance, with a separate value and with =", () => {
    expect(parseEvalArgs(["--specialist", "ticket-router", "--instance=all"])).toMatchObject({ ok: true, specialist: "ticket-router", instance: "all" })
    expect(parseEvalArgs(["--specialist=a", "--instance", "short-staffed-clinic"])).toMatchObject({ specialist: "a", instance: "short-staffed-clinic" })
  })

  it.each([[["--specialist"]], [["--specialist", "--judge"]], [["--instance"]], [["--instance", "--version"]]])("rejects %j: a value is needed", (argv) => {
    const r = parseEvalArgs(argv)
    expect(r.ok).toBe(false)
  })

  it("accepts --version with a separate value and with =", () => {
    expect(parseEvalArgs(["--version", "v2"])).toMatchObject({ ok: true, versions: ["v2"] })
    expect(parseEvalArgs(["--version=v1"])).toMatchObject({ ok: true, versions: ["v1"] })
  })

  it("accepts a repeated --version and removes duplicates", () => {
    expect(parseEvalArgs(["--version", "v1", "--version", "v2", "--version=v1"])).toMatchObject({
      versions: ["v1", "v2"],
    })
  })

  it("accepts --judge and --help in any order", () => {
    expect(parseEvalArgs(["--judge", "--version", "v2"])).toMatchObject({ judge: true, versions: ["v2"] })
    expect(parseEvalArgs(["--help"])).toMatchObject({ help: true })
    expect(parseEvalArgs(["-h"])).toMatchObject({ help: true })
  })

  it("rejects a --version with no value", () => {
    expect(parseEvalArgs(["--version"])).toEqual({ ok: false, error: expect.stringContaining("needs a value") })
    expect(parseEvalArgs(["--version", "--judge"])).toMatchObject({ ok: false })
    expect(parseEvalArgs(["--version="])).toMatchObject({ ok: false })
  })

  it("rejects unknown arguments", () => {
    expect(parseEvalArgs(["--wat"])).toEqual({ ok: false, error: "Unknown argument: --wat" })
    expect(parseEvalArgs(["v2"])).toMatchObject({ ok: false })
  })
})

describe("formatRunReport", () => {
  const base = {
    specialistId: "intake-triage",
    version: "v1",
    verdict: "FAIL",
    verdictReason: "Dev pass rate 50.0% is below the 85.0% threshold.",
    devPassed: 12,
    devTotal: 24,
    holdoutPassed: 3,
    holdoutTotal: 8,
    judgeEnabled: false,
    results: [
      { scenarioId: "d01", split: "DEV", passed: true, category: null, reason: null },
      { scenarioId: "d05", split: "DEV", passed: false, category: "THERAPY", reason: "Therapy was X, expected Y." },
    ],
  }

  it("shows the verdict, rates, reason and judge status", () => {
    const text = formatRunReport(base)
    expect(text).toContain("intake-triage v1  FAIL")
    expect(text).toContain("dev 12/24 (50.0%)")
    expect(text).toContain("hold-out 3/8 (37.5%)")
    expect(text).toContain("below the 85.0% threshold")
    expect(text).toContain("LLM judge: disabled")
  })

  it("lists only failed scenarios with category and reason", () => {
    const text = formatRunReport(base)
    expect(text).toContain("d05 (dev) [THERAPY] Therapy was X, expected Y.")
    expect(text).not.toContain("d01")
  })

  it("omits the failed list when everything passed, and shows the judge as enabled", () => {
    const text = formatRunReport({
      ...base,
      verdict: "PASS",
      judgeEnabled: true,
      results: [{ scenarioId: "d01", split: "DEV", passed: true, category: null, reason: null }],
    })
    expect(text).not.toContain("Failed scenarios")
    expect(text).toContain("LLM judge: enabled")
  })

  it("shows n/a for an empty split", () => {
    expect(formatRunReport({ ...base, holdoutPassed: 0, holdoutTotal: 0 })).toContain("hold-out 0/0 (n/a)")
  })
})

describe("describeJudge (review finding #3)", () => {
  const scored = { scenarioId: "a", split: "DEV", passed: true, category: null, reason: null, judgeScore: 4, judgeNote: "ok" }
  const failedToScore = { ...scored, scenarioId: "b", judgeScore: null, judgeNote: "Judge unavailable: boom" }

  it("is 'disabled' when the judge was off", () => {
    expect(describeJudge({ judgeEnabled: false, results: [scored] })).toBe("disabled")
  })

  it("reports full coverage", () => {
    expect(describeJudge({ judgeEnabled: true, results: [scored, scored] })).toBe("enabled, 2 of 2 scored")
  })

  it("warns when the judge was on but scored fewer than it was asked about", () => {
    const text = describeJudge({ judgeEnabled: true, results: [scored, failedToScore] })
    expect(text).toContain("only 1 of 2 scored")
    expect(text).toContain("NOT graded")
  })

  it("warns when nothing was scored", () => {
    expect(describeJudge({ judgeEnabled: true, results: [failedToScore, failedToScore] })).toContain("only 0 of 2 scored")
  })

  it("does not warn when the judge was never asked", () => {
    const neverAsked = { ...scored, judgeScore: null, judgeNote: null }
    expect(describeJudge({ judgeEnabled: true, results: [neverAsked] })).toBe("enabled, 0 of 0 scored")
  })

  it("appears in the terminal report", () => {
    const run = {
      specialistId: "intake-triage",
      version: "v2",
      verdict: "PASS",
      verdictReason: "ok",
      devPassed: 1,
      devTotal: 1,
      holdoutPassed: 0,
      holdoutTotal: 0,
      judgeEnabled: true,
      results: [failedToScore],
    }
    expect(formatRunReport(run)).toContain("LLM judge: enabled, but only 0 of 1 scored")
  })
})
