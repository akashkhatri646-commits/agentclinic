import { prisma } from "../src/lib/prisma"
import { USAGE, formatRunReport, parseEvalArgs } from "../src/lib/evals/cli"
import { STANDARD_INSTANCE, listInstances } from "../src/lib/evals/instances"
import { createAnthropicJudge } from "../src/lib/evals/judge"
import { runEval } from "../src/lib/evals/runner"
import { listSpecialists, loadSpecialist } from "../src/lib/evals/specialist-store"

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

  const all = await listSpecialists(prisma)
  const slug = args.specialist ?? all[0]?.slug
  const specialist = slug ? await loadSpecialist(prisma, slug) : null
  if (!specialist) {
    console.error(
      slug
        ? `Unknown specialist: ${slug}. Available: ${all.map((s) => s.slug).join(", ") || "none"}.`
        : "There are no specialists. Run the database seed first."
    )
    return 2
  }

  // Only versions that run from code can be run here; the others get their outputs by import.
  const available = specialist.versions.filter((v) => v.builtinKey).map((v) => v.label)
  const versions = args.versions ?? available
  const unknown = versions.filter((v) => !available.includes(v))
  if (unknown.length > 0) {
    console.error(
      `Cannot run: ${unknown.join(", ")}. Versions that run from code: ${available.join(", ") || "none"}.`
    )
    return 2
  }

  const instances = await listInstances(prisma)
  const requested = args.instance ?? STANDARD_INSTANCE
  const chosen = requested === "all" ? instances.map((i) => i.slug) : instances.filter((i) => i.slug === requested).map((i) => i.slug)
  if (chosen.length === 0) {
    console.error(`Unknown instance: ${requested}. Available: ${instances.map((i) => i.slug).join(", ")}, or "all".`)
    return 2
  }

  let judge = null
  if (args.judge) {
    judge = await createAnthropicJudge()
    if (!judge) console.log("Note: --judge was given but ANTHROPIC_API_KEY is not set, so the judge is disabled.\n")
  }

  let anyFailed = false
  for (const instance of chosen) {
    for (const version of versions) {
      const run = await runEval({ specialistId: specialist.spec.slug, version, instance, triggeredBy: "cli", judge })
      console.log(formatRunReport(run) + "\n")
      if (run.verdict === "FAIL") anyFailed = true
    }
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
