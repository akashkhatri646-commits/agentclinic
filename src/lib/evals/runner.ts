import type { PrismaClient } from "@prisma/client"
import { prisma } from "../prisma"
import { runChecks } from "./checks"
import { getScenarios } from "./scenarios/intake-triage"
import { getSpecialistVersion } from "./specialists"
import type { FailureCategory, Judge, Scenario } from "./types"
import { JUDGE_PASS_SCORE, computeVerdict } from "./verdict"

/** The slice of the database client the runner needs, so a seed script or test can supply its own. */
export type EvalDb = Pick<PrismaClient, "therapy" | "evalRun">

export type RunEvalOptions = {
  specialistId: string
  version: string
  /** A user id, or "cli". */
  triggeredBy?: string | null
  /** Optional rationale judge. Omit to run deterministic checks only. */
  judge?: Judge | null
  db?: EvalDb
}

type ResultRow = {
  scenarioId: string
  split: Scenario["split"]
  passed: boolean
  category: FailureCategory | null
  reason: string | null
  expectedSeverity: string
  expectedTherapy: string
  actualSeverity: string
  actualTherapy: string
  rationale: string
  judgeScore: number | null
  judgeNote: string | null
}

/**
 * Runs every scenario for one specialist version against the live clinic
 * environment (the current therapy catalogue), computes the verdict, and
 * stores the run with all its results in a single nested write.
 */
export async function runEval(options: RunEvalOptions) {
  const { specialistId, version, triggeredBy = null, judge = null, db = prisma } = options

  const specialist = getSpecialistVersion(specialistId, version)
  if (!specialist) throw new Error(`Unknown specialist version: ${specialistId} ${version}.`)

  const scenarios = getScenarios(specialistId)
  const catalogue = (await db.therapy.findMany({ select: { name: true } })).map((t) => t.name)

  const rows: ResultRow[] = []
  for (const scenario of scenarios) {
    const output = specialist.run({ description: scenario.description, therapies: catalogue })
    const check = runChecks(scenario, output, catalogue)

    let { passed, category, reason } = check
    let judgeScore: number | null = null
    let judgeNote: string | null = null

    // The judge only looks at answers that already passed the deterministic
    // checks: a failed scenario already has a reason. A judge problem is never
    // allowed to fail a scenario; only a returned low score does.
    if (judge && check.passed) {
      try {
        const result = await judge.score(scenario.description, output.rationale)
        judgeScore = result.score
        judgeNote = result.note
        if (result.score !== null && result.score < JUDGE_PASS_SCORE) {
          passed = false
          category = "RATIONALE"
          reason = `Rationale scored ${result.score}/5 (pass is ${JUDGE_PASS_SCORE}): ${result.note}`
        }
      } catch (e) {
        judgeNote = `Judge unavailable: ${e instanceof Error ? e.message : "unknown error"}`
      }
    }

    rows.push({
      scenarioId: scenario.id,
      split: scenario.split,
      passed,
      category,
      reason,
      expectedSeverity: scenario.expectedSeverity,
      expectedTherapy: scenario.expectedTherapy,
      actualSeverity: output.severity,
      actualTherapy: output.therapy,
      rationale: output.rationale,
      judgeScore,
      judgeNote,
    })
  }

  const dev = rows.filter((r) => r.split === "DEV")
  const holdout = rows.filter((r) => r.split === "HOLDOUT")
  const counts = {
    devTotal: dev.length,
    devPassed: dev.filter((r) => r.passed).length,
    holdoutTotal: holdout.length,
    holdoutPassed: holdout.filter((r) => r.passed).length,
  }
  const { verdict, reason } = computeVerdict(counts)
  const verdictReason =
    catalogue.length === 0
      ? `The therapy catalogue is empty, so no recommendation can be valid. ${reason}`
      : reason

  return db.evalRun.create({
    data: {
      specialistId,
      version,
      status: "COMPLETED",
      ...counts,
      verdict,
      verdictReason,
      judgeEnabled: judge !== null,
      triggeredBy,
      results: { create: rows },
    },
    include: { results: true },
  })
}
