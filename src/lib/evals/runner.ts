import type { PrismaClient } from "@prisma/client"
import { getBuiltinRunner } from "./builtin"
import { gradeOutputs, type OutputValues } from "./grade"
import { STANDARD_INSTANCE, resolveInstance } from "./instances"
import { loadSpecialist } from "./specialist-store"
import { syncFailureModes, type TriageDb } from "./triage-sync"
import type { Judge } from "./types"
import { computeVerdict, judgeCoverage } from "./verdict"

/** The slice of the database client the runner needs, so a seed script or test can supply its own. */
export type EvalDb = Pick<PrismaClient, "therapy" | "evalRun" | "instance"> & TriageDb

export type RunEvalOptions = {
  /** The specialist's slug. */
  specialistId: string
  version: string
  /** The customer instance to run against. Default: the standard clinic. */
  instance?: string
  /** A user id, or "cli". */
  triggeredBy?: string | null
  /** Optional judge. Omit to run deterministic checks only. */
  judge?: Judge | null
  /**
   * What the specialist returned, by scenario id. Required for versions that do not generate
   * their outputs from code; ignored for built-in versions.
   */
  outputs?: Record<string, OutputValues>
  db?: EvalDb
  /**
   * Overrides the recorded timestamps. Only the seed uses this, to record an
   * illustrative history. Must be ordered: shipped, then started, then finished.
   */
  timing?: { changeShippedAt: Date; startedAt: Date; finishedAt: Date }
  /** Marks the run as illustrative sample data. Never set for real runs. */
  isSample?: boolean
}

/**
 * Runs every scenario of one specialist version against one customer instance, grades the
 * outputs, computes the verdict, and stores the run with all its results in a single nested
 * write. Built-in versions generate their outputs here; every other version must be given
 * its outputs. Either way the grading is the same.
 */
export async function runEval(options: RunEvalOptions) {
  const {
    specialistId,
    version,
    instance: instanceSlug = STANDARD_INSTANCE,
    triggeredBy = null,
    judge = null,
    timing,
    isSample = false,
  } = options

  // The shared client is loaded only when the caller did not supply one, so a
  // seed script or test that passes its own never constructs a second client.
  const db = options.db ?? ((await import("../prisma")).prisma as unknown as EvalDb)

  const specialist = await loadSpecialist(db, specialistId)
  if (!specialist) throw new Error(`Unknown specialist: ${specialistId}.`)
  const versionRow = specialist.versions.find((v) => v.label === version)
  if (!versionRow) throw new Error(`Unknown specialist version: ${specialistId} ${version}.`)

  const instance = await resolveInstance(db, instanceSlug)
  if (!instance) throw new Error(`Unknown instance: ${instanceSlug}.`)

  if (timing) {
    if (timing.startedAt < timing.changeShippedAt) {
      throw new Error("A run cannot start before its change shipped.")
    }
    if (timing.finishedAt < timing.startedAt) {
      throw new Error("A run cannot finish before it started.")
    }
  }

  // "Run started": taken before any scenario runs.
  const startedAt = timing?.startedAt ?? new Date()

  const spec = specialist.spec
  const generate = getBuiltinRunner(versionRow.builtinKey)
  let outputs: Record<string, OutputValues>
  if (generate) {
    outputs = Object.fromEntries(spec.scenarios.map((s) => [s.id, generate(s.input, instance.lists)]))
  } else if (options.outputs) {
    outputs = options.outputs
  } else {
    throw new Error(`Version ${version} does not generate its own outputs, so its outputs must be imported.`)
  }

  const graded = await gradeOutputs({ spec, outputs, lists: instance.lists, judge })
  const counts = {
    devTotal: graded.devTotal,
    devPassed: graded.devPassed,
    holdoutTotal: graded.holdoutTotal,
    holdoutPassed: graded.holdoutPassed,
  }
  const { verdict, reason } = computeVerdict(counts)

  // An empty reference list makes every value that must be in it invalid; say so.
  const usedLists = Array.from(new Set(spec.checks.flatMap((c) => (c.type === "inReference" ? [c.list] : []))))
  const emptyLists = usedLists.filter((name) => (instance.lists[name] ?? []).length === 0)
  let verdictReason =
    emptyLists.length > 0
      ? `The ${emptyLists.map((n) => `"${n}"`).join(" and ")} list${emptyLists.length > 1 ? "s are" : " is"} empty for ${instance.name}, so no value can be valid. ${reason}`
      : reason

  // A judge that was switched on but could not score must not look like a graded run.
  if (judge) {
    const { attempted, scored } = judgeCoverage(graded.rows)
    if (attempted > 0 && scored < attempted) {
      verdictReason += ` The LLM judge was enabled but scored only ${scored} of ${attempted} answers, so the rest were not graded.`
    }
  }

  // "Verdict produced": taken after the judge (if any) has finished.
  const finishedAt = timing?.finishedAt ?? new Date()

  const created = await db.evalRun.create({
    data: {
      specialistId,
      version,
      status: "COMPLETED",
      ...counts,
      verdict,
      verdictReason,
      judgeEnabled: judge !== null,
      triggeredBy,
      instanceSlug: instance.slug,
      outputsSource: generate ? "BUILTIN" : "IMPORTED",
      // "Change shipped" comes from the version's release date, copied onto the run.
      changeShippedAt: timing?.changeShippedAt ?? versionRow.releasedAt,
      startedAt,
      finishedAt,
      isSample,
      // With explicit timing, createdAt follows finishedAt so list order and the
      // previous-version lookup (which use createdAt) agree with the recorded history.
      ...(timing ? { createdAt: finishedAt } : {}),
      results: {
        create: graded.rows.map((r) => ({
          scenarioId: r.scenarioId,
          split: r.split,
          passed: r.passed,
          category: r.category,
          reason: r.reason,
          expected: JSON.stringify(r.expected),
          actual: JSON.stringify(r.actual),
          judgeScore: r.judgeScore,
          judgeNote: r.judgeNote,
        })),
      },
    },
    include: { results: true },
  })

  // Bring the triage backlog up to date. This is bookkeeping around the run, so a
  // problem here is logged and never fails the run (the rule used for notifications
  // and the judge). Sync only looks at the state and this run, so the next run catches up.
  try {
    await syncFailureModes(created, db)
  } catch (e) {
    console.error("Failed to update the triage backlog after an eval run", e)
  }

  return created
}
