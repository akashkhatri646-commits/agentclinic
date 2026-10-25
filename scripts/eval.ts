import { prisma } from "../src/lib/prisma"
import { USAGE, formatRunReport, parseEvalArgs } from "../src/lib/evals/cli"
import { createAnthropicJudge } from "../src/lib/evals/judge"
import { runEval } from "../src/lib/evals/runner"
import { INTAKE_TRIAGE_ID, listVersions } from "../src/lib/evals/specialists"

async function main(): Promise<number> {
  const args = parseEvalArgs(process.argv.slice(2))
  if (!args.ok) {
    console.error(`${args.error}\n\n${USAGE}`)
    return 2
  }
  if (args.help) {
    console.log(USAGE)
    return 0
  }

  const available = listVersions(INTAKE_TRIAGE_ID).map((s) => s.version)
  const versions = args.versions ?? available
  const unknown = versions.filter((v) => !available.includes(v))
  if (unknown.length > 0) {
    console.error(`Unknown version: ${unknown.join(", ")}. Available: ${available.join(", ")}.`)
    return 2
  }

  let judge = null
  if (args.judge) {
    judge = await createAnthropicJudge()
    if (!judge) console.log("Note: --judge was given but ANTHROPIC_API_KEY is not set, so the judge is disabled.\n")
  }

  let anyFailed = false
  for (const version of versions) {
    const run = await runEval({ specialistId: INTAKE_TRIAGE_ID, version, triggeredBy: "cli", judge })
    console.log(formatRunReport(run) + "\n")
    if (run.verdict === "FAIL") anyFailed = true
  }
  return anyFailed ? 1 : 0
}

main()
  .then(async (code) => {
    await prisma.$disconnect()
    process.exit(code)
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
