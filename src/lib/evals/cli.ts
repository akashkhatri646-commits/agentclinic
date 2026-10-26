import { formatPercent, judgeCoverage, rate } from "./verdict"

export type EvalArgs =
  | { ok: true; specialist: string | null; instance: string | null; versions: string[] | null; judge: boolean; help: boolean }
  | { ok: false; error: string }

export const USAGE = `Usage: npm run eval -- [--specialist <slug>] [--instance <slug>|all] [--version v1|v2] [--judge]

  --specialist <s>  Which specialist to run. Default: the first one created (intake-triage in the seeded database).
  --instance <i>    Which customer instance to run against, or "all" for one run on each. Default: standard-clinic.
  --version <v>   Run only this specialist version (repeatable). Default: every version that runs from code, in release order.
  --judge         Also score rationales with the LLM judge. Needs ANTHROPIC_API_KEY; ignored with a notice if it is not set.
  --help          Show this message.

Exits with status 1 if any run has a FAIL verdict, and 2 on a usage error.`

/** Parses the CLI arguments. Pure so it can be tested without a database. */
export function parseEvalArgs(argv: string[]): EvalArgs {
  const versions: string[] = []
  let judge = false
  let help = false
  let specialist: string | null = null
  let instance: string | null = null

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--judge") {
      judge = true
    } else if (arg === "--help" || arg === "-h") {
      help = true
    } else if (arg === "--specialist" || arg.startsWith("--specialist=")) {
      const value = arg === "--specialist" ? argv[++i] : arg.slice("--specialist=".length)
      if (!value || value.startsWith("--")) return { ok: false, error: "--specialist needs a value, e.g. --specialist intake-triage." }
      specialist = value
    } else if (arg === "--instance" || arg.startsWith("--instance=")) {
      const value = arg === "--instance" ? argv[++i] : arg.slice("--instance=".length)
      if (!value || value.startsWith("--")) return { ok: false, error: "--instance needs a value, e.g. --instance short-staffed-clinic or --instance all." }
      instance = value
    } else if (arg === "--version" || arg.startsWith("--version=")) {
      const value = arg === "--version" ? argv[++i] : arg.slice("--version=".length)
      if (!value || value.startsWith("--")) return { ok: false, error: "--version needs a value, e.g. --version v2." }
      versions.push(value)
    } else {
      return { ok: false, error: `Unknown argument: ${arg}` }
    }
  }

  return { ok: true, specialist, instance, versions: versions.length ? Array.from(new Set(versions)) : null, judge, help }
}

type ReportRun = {
  specialistId: string
  version: string
  instanceSlug?: string
  verdict: string
  verdictReason: string
  devPassed: number
  devTotal: number
  holdoutPassed: number
  holdoutTotal: number
  judgeEnabled: boolean
  results: {
    scenarioId: string
    split: string
    passed: boolean
    category: string | null
    reason: string | null
    judgeScore?: number | null
    judgeNote?: string | null
  }[]
}

/** "disabled", or how much of the judge's work actually produced scores. */
export function describeJudge(run: Pick<ReportRun, "judgeEnabled" | "results">): string {
  if (!run.judgeEnabled) return "disabled"
  const { attempted, scored } = judgeCoverage(
    run.results.map((r) => ({ judgeScore: r.judgeScore ?? null, judgeNote: r.judgeNote ?? null }))
  )
  return scored < attempted
    ? `enabled, but only ${scored} of ${attempted} scored; the rest were NOT graded`
    : `enabled, ${scored} of ${attempted} scored`
}

/** Plain-text summary of one run for the terminal. */
export function formatRunReport(run: ReportRun): string {
  const lines = [
    `${run.specialistId} ${run.version}${run.instanceSlug ? ` on ${run.instanceSlug}` : ""}  ${run.verdict}`,
    `  dev ${run.devPassed}/${run.devTotal} (${formatPercent(rate(run.devPassed, run.devTotal))})` +
      `   hold-out ${run.holdoutPassed}/${run.holdoutTotal} (${formatPercent(rate(run.holdoutPassed, run.holdoutTotal))})`,
    `  ${run.verdictReason}`,
    `  LLM judge: ${describeJudge(run)}`,
  ]
  const failed = run.results.filter((r) => !r.passed)
  if (failed.length > 0) {
    lines.push("  Failed scenarios:")
    for (const r of failed) {
      lines.push(`    ${r.scenarioId} (${r.split.toLowerCase()}) [${r.category ?? "UNKNOWN"}] ${r.reason ?? ""}`.trimEnd())
    }
  }
  return lines.join("\n")
}
