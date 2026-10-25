import { canRunEvals } from "../guards"
import { createAnthropicJudge, isJudgeConfigured } from "./judge"
import { runEval } from "./runner"
import { INTAKE_TRIAGE_ID, getSpecialistVersion } from "./specialists"

export type EvalErrorCode = "forbidden" | "unknown-version" | "run-failed"

/**
 * Fixed messages for each error code. The UI shows these, never text taken
 * from the URL, so a crafted link cannot display arbitrary wording.
 */
export const EVAL_ERROR_MESSAGES: Record<EvalErrorCode, string> = {
  forbidden: "You do not have access to run evals.",
  "unknown-version": "That specialist version does not exist.",
  "run-failed": "The eval run could not be completed. Please try again.",
}

export function isEvalErrorCode(value: string | undefined): value is EvalErrorCode {
  return value !== undefined && Object.prototype.hasOwnProperty.call(EVAL_ERROR_MESSAGES, value)
}

export type StartEvalResult = { ok: true; runId: string } | { ok: false; code: EvalErrorCode }

/**
 * Everything the "Run eval" action does after reading the form: authorise,
 * validate the version, optionally attach the judge, run, and report the new
 * run id or an error code. Kept apart from the server action so it can be tested.
 */
export async function startEvalRun(input: {
  role: string
  userId: string
  version: string
  useJudge: boolean
}): Promise<StartEvalResult> {
  if (!canRunEvals(input.role)) return { ok: false, code: "forbidden" }
  if (!getSpecialistVersion(INTAKE_TRIAGE_ID, input.version)) {
    return { ok: false, code: "unknown-version" }
  }

  try {
    // The judge is only used when asked for AND configured; otherwise the checkbox is ignored.
    const judge = input.useJudge && isJudgeConfigured() ? await createAnthropicJudge() : null
    const run = await runEval({
      specialistId: INTAKE_TRIAGE_ID,
      version: input.version,
      triggeredBy: input.userId,
      judge,
    })
    return { ok: true, runId: run.id }
  } catch (e) {
    console.error("Eval run failed", e)
    return { ok: false, code: "run-failed" }
  }
}
