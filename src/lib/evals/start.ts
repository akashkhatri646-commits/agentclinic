import { canRunEvals } from "../guards"
import { createAnthropicJudge, isJudgeConfigured } from "./judge"
import { STANDARD_INSTANCE, listInstances } from "./instances"
import { runEval, type EvalDb } from "./runner"
import { recordEvent, type ServiceDb } from "./specialist-service"
import { loadSpecialist } from "./specialist-store"

export type EvalErrorCode =
  | "forbidden"
  | "unknown-specialist"
  | "unknown-version"
  | "unknown-instance"
  | "needs-outputs"
  | "partial-run"
  | "run-failed"

/**
 * Fixed messages for each error code. The UI shows these, never text taken
 * from the URL, so a crafted link cannot display arbitrary wording.
 */
export const EVAL_ERROR_MESSAGES: Record<EvalErrorCode, string> = {
  forbidden: "You do not have access to run evals.",
  "unknown-specialist": "That specialist does not exist.",
  "unknown-version": "That specialist version does not exist.",
  "unknown-instance": "That customer instance does not exist.",
  "needs-outputs": "This version does not run from code. Import its outputs to get a verdict.",
  "partial-run": "Some runs were saved before one failed. Check the runs list before running again, so nothing is duplicated.",
  "run-failed": "The eval run could not be completed. Please try again.",
}

export function isEvalErrorCode(value: string | undefined): value is EvalErrorCode {
  return value !== undefined && Object.prototype.hasOwnProperty.call(EVAL_ERROR_MESSAGES, value)
}

/** `runId` is the last run made; `runIds` lists every run, one per instance. */
export type StartEvalResult = { ok: true; runId: string; runIds: string[] } | { ok: false; code: EvalErrorCode }

export const ALL_INSTANCES = "all"

/**
 * Everything the "Run eval" action does after reading the form: authorise, validate the
 * specialist, version and instance, optionally attach the judge, run, and report the new
 * run id or an error code. `instance` may be "all" to run once on every instance.
 * Kept apart from the server action so it can be tested.
 */
export async function startEvalRun(input: {
  role: string
  userId: string
  specialist: string
  version: string
  instance: string
  useJudge: boolean
  db?: EvalDb
}): Promise<StartEvalResult> {
  if (!canRunEvals(input.role)) return { ok: false, code: "forbidden" }

  try {
    const db = input.db ?? ((await import("../prisma")).prisma as unknown as EvalDb)

    const specialist = await loadSpecialist(db, input.specialist)
    if (!specialist) return { ok: false, code: "unknown-specialist" }
    const version = specialist.versions.find((v) => v.label === input.version)
    if (!version) return { ok: false, code: "unknown-version" }
    if (!version.builtinKey) return { ok: false, code: "needs-outputs" }

    const instances = await listInstances(db)
    const chosen =
      input.instance === ALL_INSTANCES ? instances.map((i) => i.slug) : instances.filter((i) => i.slug === input.instance).map((i) => i.slug)
    if (chosen.length === 0) return { ok: false, code: "unknown-instance" }

    // The judge is only used when asked for AND configured; otherwise the checkbox is ignored.
    const judge = input.useJudge && isJudgeConfigured() ? await createAnthropicJudge() : null
    const runIds: string[] = []
    try {
      for (const instance of chosen) {
        const run = await runEval({
          specialistId: input.specialist,
          version: input.version,
          instance,
          triggeredBy: input.userId,
          judge,
          db,
        })
        runIds.push(run.id)
      }
    } catch (e) {
      // Runs already saved stay saved, so say so and record that they happened.
      if (runIds.length > 0) {
        console.error("A run on one instance failed after others were saved", e)
        await recordEvent(db as ServiceDb, specialist.id, "RUN_STARTED", { id: input.userId, role: input.role })
        return { ok: false, code: "partial-run" }
      }
      throw e
    }
    await recordEvent(db as ServiceDb, specialist.id, "RUN_STARTED", { id: input.userId, role: input.role })
    return { ok: true, runId: runIds[runIds.length - 1], runIds }
  } catch (e) {
    console.error("Eval run failed", e)
    return { ok: false, code: "run-failed" }
  }
}

export { STANDARD_INSTANCE }
