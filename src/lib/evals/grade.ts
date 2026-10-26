import type { Check, CheckType, ScenarioSpec, SpecialistSpec } from "./spec"
import type { Judge, Split } from "./types"
import { JUDGE_PASS_SCORE } from "./verdict"

/**
 * The generic grading engine: applies a specialist's checks to the values it returned.
 * It knows nothing about any particular specialist's fields. Pure apart from the
 * optional judge, which is injected.
 */

/** What a specialist returned for one scenario: text values by output field name. */
export type OutputValues = Record<string, string>

/** Named lists of allowed values that an environment provides, for `inReference` checks. */
export type ReferenceLists = Record<string, string[]>

export type CheckOutcome = {
  passed: boolean
  /** The failing checks as `TYPE:field`, sorted and joined by `+`, or null when everything passed. */
  category: string | null
  reason: string | null
}

const CATEGORY: Record<CheckType, string> = {
  equals: "MISMATCH",
  oneOf: "NOT_ALLOWED",
  inReference: "NOT_IN_REFERENCE",
  nonEmpty: "EMPTY",
}

export const JUDGE_CATEGORY_PREFIX = "JUDGE"

const text = (value: string | undefined): string => (value ?? "").trim()

type Failure = { key: string; reason: string }

function failureOf(check: Check, scenario: ScenarioSpec, output: OutputValues, lists: ReferenceLists): Failure | null {
  const actual = text(output[check.field])
  switch (check.type) {
    case "equals": {
      const expected = scenario.expected[check.field] ?? ""
      if (actual === expected) return null
      return {
        key: `${CATEGORY.equals}:${check.field}`,
        reason: actual === "" ? `${check.field} was empty, expected "${expected}"` : `${check.field} was "${actual}", expected "${expected}"`,
      }
    }
    case "oneOf": {
      if (check.values.includes(actual)) return null
      return {
        key: `${CATEGORY.oneOf}:${check.field}`,
        reason: `${check.field} was ${actual === "" ? "empty" : `"${actual}"`}, which is not one of: ${check.values.join(", ")}`,
      }
    }
    case "inReference": {
      const allowed = lists[check.list]
      if (!allowed) {
        return {
          key: `${CATEGORY.inReference}:${check.field}`,
          reason: `this environment has no "${check.list}" list, so ${check.field} cannot be checked against it`,
        }
      }
      if (actual !== "" && allowed.includes(actual)) return null
      return {
        key: `${CATEGORY.inReference}:${check.field}`,
        reason: `${check.field} ${actual === "" ? "was empty" : `"${actual}"`} is not in this environment's "${check.list}" list`,
      }
    }
    case "nonEmpty":
      return actual === "" ? { key: `${CATEGORY.nonEmpty}:${check.field}`, reason: `${check.field} is empty` } : null
  }
}

/**
 * Runs every check of a specialist against one scenario's output. A scenario passes only
 * if every check passes. A failure carries a category (all failing checks) and a reason
 * (one clause per failing check).
 */
export function runFieldChecks(
  scenario: ScenarioSpec,
  output: OutputValues,
  spec: Pick<SpecialistSpec, "checks">,
  lists: ReferenceLists
): CheckOutcome {
  const failures = spec.checks
    .map((c) => failureOf(c, scenario, output, lists))
    .filter((f): f is Failure => f !== null)
  if (failures.length === 0) return { passed: true, category: null, reason: null }

  const category = Array.from(new Set(failures.map((f) => f.key))).sort().join("+")
  const joined = failures.map((f) => f.reason).join("; ")
  return { passed: false, category, reason: `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.` }
}

export type GradedRow = {
  scenarioId: string
  split: Split
  theme: string
  passed: boolean
  category: string | null
  reason: string | null
  expected: Record<string, string>
  actual: OutputValues
  judgeScore: number | null
  judgeNote: string | null
}

export type GradedRun = {
  rows: GradedRow[]
  devTotal: number
  devPassed: number
  holdoutTotal: number
  holdoutPassed: number
}

/**
 * Grades a full set of outputs, one entry per scenario id. The judge, if given and if the
 * spec names a field for it, scores only scenarios that already passed the checks, since a
 * failed scenario already has a reason. A judge problem never fails a scenario: only a
 * returned score below the pass mark does.
 */
export async function gradeOutputs(input: {
  spec: Pick<SpecialistSpec, "checks" | "scenarios" | "judge">
  outputs: Record<string, OutputValues>
  lists: ReferenceLists
  judge?: Judge | null
}): Promise<GradedRun> {
  const { spec, outputs, lists, judge = null } = input
  const rows: GradedRow[] = []

  for (const scenario of spec.scenarios) {
    const actual = outputs[scenario.id] ?? {}
    const outcome = runFieldChecks(scenario, actual, spec, lists)

    let { passed, category, reason } = outcome
    let judgeScore: number | null = null
    let judgeNote: string | null = null

    if (judge && spec.judge && outcome.passed) {
      const field = spec.judge.field
      try {
        const result = await judge.score(scenario.input, text(actual[field]))
        judgeScore = result.score
        judgeNote = result.note
        if (result.score !== null && result.score < JUDGE_PASS_SCORE) {
          passed = false
          category = `${JUDGE_CATEGORY_PREFIX}:${field}`
          reason = `The ${field} scored ${result.score}/5 (pass is ${JUDGE_PASS_SCORE}): ${result.note}`
        }
      } catch (e) {
        judgeNote = `Judge unavailable: ${e instanceof Error ? e.message : "unknown error"}`
      }
    }

    rows.push({
      scenarioId: scenario.id,
      split: scenario.split,
      theme: scenario.theme,
      passed,
      category,
      reason,
      expected: scenario.expected,
      actual,
      judgeScore,
      judgeNote,
    })
  }

  const dev = rows.filter((r) => r.split === "DEV")
  const holdout = rows.filter((r) => r.split === "HOLDOUT")
  return {
    rows,
    devTotal: dev.length,
    devPassed: dev.filter((r) => r.passed).length,
    holdoutTotal: holdout.length,
    holdoutPassed: holdout.filter((r) => r.passed).length,
  }
}
