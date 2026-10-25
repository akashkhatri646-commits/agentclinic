import { formatPercent, rate } from "./verdict"

export type EvalArgs =
  | { ok: true; versions: string[] | null; judge: boolean; help: boolean }
  | { ok: false; error: string }

export const USAGE = `Usage: npm run eval -- [--version v1|v2] [--judge]

  --version <v>   Run only this specialist version (repeatable). Default: every version, in release order.
  --judge         Also score rationales with the LLM judge. Needs ANTHROPIC_API_KEY; ignored with a notice if it is not set.
  --help          Show this message.

Exits with status 1 if any run has a FAIL verdict, and 2 on a usage error.`

/** Parses the CLI arguments. Pure so it can be tested without a database. */
export function parseEvalArgs(argv: string[]): EvalArgs {
  const versions: string[] = []
  let judge = false
  let help = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--judge") {
      judge = true
    } else if (arg === "--help" || arg === "-h") {
      help = true
    } else if (arg === "--version" || arg.startsWith("--version=")) {
      const value = arg === "--version" ? argv[++i] : arg.slice("--version=".length)
      if (!value || value.startsWith("--")) return { ok: false, error: "--version needs a value, e.g. --version v2." }
      versions.push(value)
    } else {
      return { ok: false, error: `Unknown argument: ${arg}` }
    }
  }

  return { ok: true, versions: versions.length ? Array.from(new Set(versions)) : null, judge, help }
}

type ReportRun = {
  specialistId: string
  version: string
  verdict: string
  verdictReason: string
  devPassed: number
  devTotal: number
  holdoutPassed: number
  holdoutTotal: number
  judgeEnabled: boolean
  results: { scenarioId: string; split: string; passed: boolean; category: string | null; reason: string | null }[]
}

/** Plain-text summary of one run for the terminal. */
export function formatRunReport(run: ReportRun): string {
  const lines = [
    `${run.specialistId} ${run.version}  ${run.verdict}`,
    `  dev ${run.devPassed}/${run.devTotal} (${formatPercent(rate(run.devPassed, run.devTotal))})` +
      `   hold-out ${run.holdoutPassed}/${run.holdoutTotal} (${formatPercent(rate(run.holdoutPassed, run.holdoutTotal))})`,
    `  ${run.verdictReason}`,
    `  LLM judge: ${run.judgeEnabled ? "enabled" : "disabled"}`,
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
