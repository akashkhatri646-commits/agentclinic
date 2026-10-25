import { describe, it, expect, vi, beforeEach } from "vitest"
import { EVAL_ERROR_MESSAGES, isEvalErrorCode, startEvalRun } from "../lib/evals/start"
import { runEval } from "../lib/evals/runner"
import { createAnthropicJudge, isJudgeConfigured } from "../lib/evals/judge"

vi.mock("../lib/evals/runner", () => ({ runEval: vi.fn() }))
vi.mock("../lib/evals/judge", () => ({
  createAnthropicJudge: vi.fn(),
  isJudgeConfigured: vi.fn(),
}))

const input = { role: "STAFF", userId: "user-1", version: "v2", useJudge: false }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(runEval).mockResolvedValue({ id: "run-9" } as never)
  vi.mocked(isJudgeConfigured).mockReturnValue(false)
})

describe("startEvalRun access", () => {
  it.each([["STAFF"], ["ADMIN"]])("lets %s start a run", async (role) => {
    expect(await startEvalRun({ ...input, role })).toEqual({ ok: true, runId: "run-9" })
  })

  it.each([["AGENT"], [""], ["staff"], ["SUPERUSER"]])(
    "rejects role %j and never runs anything",
    async (role) => {
      expect(await startEvalRun({ ...input, role })).toEqual({ ok: false, code: "forbidden" })
      expect(runEval).not.toHaveBeenCalled()
    }
  )
})

describe("startEvalRun validation", () => {
  it.each([["v9"], [""], ["V2"], ["v2 "]])("rejects the unknown version %j", async (version) => {
    expect(await startEvalRun({ ...input, version })).toEqual({ ok: false, code: "unknown-version" })
    expect(runEval).not.toHaveBeenCalled()
  })

  it("records who triggered the run", async () => {
    await startEvalRun(input)
    expect(runEval).toHaveBeenCalledWith(
      expect.objectContaining({ specialistId: "intake-triage", version: "v2", triggeredBy: "user-1" })
    )
  })

  it("reports run-failed, without throwing, when the runner fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(runEval).mockRejectedValue(new Error("db down"))
    expect(await startEvalRun(input)).toEqual({ ok: false, code: "run-failed" })
    spy.mockRestore()
  })
})

describe("startEvalRun judge", () => {
  it("does not create a judge when it was not requested", async () => {
    vi.mocked(isJudgeConfigured).mockReturnValue(true)
    await startEvalRun({ ...input, useJudge: false })
    expect(createAnthropicJudge).not.toHaveBeenCalled()
    expect(vi.mocked(runEval).mock.calls[0][0].judge).toBeNull()
  })

  it("ignores the request when no judge is configured", async () => {
    await startEvalRun({ ...input, useJudge: true })
    expect(createAnthropicJudge).not.toHaveBeenCalled()
    expect(vi.mocked(runEval).mock.calls[0][0].judge).toBeNull()
  })

  it("passes a judge when requested and configured", async () => {
    const judge = { score: vi.fn() }
    vi.mocked(isJudgeConfigured).mockReturnValue(true)
    vi.mocked(createAnthropicJudge).mockResolvedValue(judge)
    await startEvalRun({ ...input, useJudge: true })
    expect(vi.mocked(runEval).mock.calls[0][0].judge).toBe(judge)
  })
})

describe("error codes", () => {
  it("has a fixed message for every code", () => {
    for (const message of Object.values(EVAL_ERROR_MESSAGES)) expect(message.length).toBeGreaterThan(10)
  })

  it("only recognises known codes, so arbitrary query text is never shown", () => {
    expect(isEvalErrorCode("forbidden")).toBe(true)
    expect(isEvalErrorCode("run-failed")).toBe(true)
    expect(isEvalErrorCode("Your session expired, call support")).toBe(false)
    expect(isEvalErrorCode("toString")).toBe(false)
    expect(isEvalErrorCode("__proto__")).toBe(false)
    expect(isEvalErrorCode(undefined)).toBe(false)
  })
})
