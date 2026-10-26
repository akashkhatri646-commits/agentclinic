import type { PrismaClient } from "@prisma/client"
import type { OnboardingFacts } from "./onboarding"

export type OnboardingDb = Pick<PrismaClient, "specialist" | "evalRun" | "fix" | "fixEvent" | "user">

type SpecialistInput = {
  slug: string
  ownerId: string
  createdAt: Date
  isSample: boolean
  scenarios: { split: string }[]
  versions: unknown[]
  events: { actorId: string | null; actorRole: string | null; createdAt: Date }[]
}
type RunInput = { specialistId: string; createdAt: Date; finishedAt: Date | null; triggeredBy: string | null; isSample: boolean }
type FixInput = { id: string; status: string; verifiedAt: Date | null; failureMode: { specialistId: string } }
type FixEventInput = { fixId: string; actorId: string | null; at: Date }
type UserInput = { id: string; role: string }

/**
 * Joins what the database holds into one set of facts per specialist. A run's actor is
 * whoever triggered it, when that is a person (the CLI and the seed are not people); a fix
 * event's actor is who moved the fix, and a verification by the system has none.
 */
export function buildFacts(input: {
  specialists: SpecialistInput[]
  runs: RunInput[]
  fixes: FixInput[]
  fixEvents: FixEventInput[]
  users: UserInput[]
}): OnboardingFacts[] {
  const role = new Map(input.users.map((u) => [u.id, u.role]))
  const fixSpecialist = new Map(input.fixes.map((f) => [f.id, f.failureMode.specialistId]))

  return input.specialists.map((s) => {
    const runs = input.runs.filter((r) => r.specialistId === s.slug)
    const fixes = input.fixes.filter((f) => f.failureMode.specialistId === s.slug)
    const acts: OnboardingFacts["acts"] = [
      ...s.events.map((e) => ({ actorId: e.actorId, actorRole: e.actorRole, at: e.createdAt })),
      ...runs
        .filter((r) => r.triggeredBy !== null && role.has(r.triggeredBy))
        .map((r) => ({ actorId: r.triggeredBy, actorRole: role.get(r.triggeredBy as string) ?? null, at: r.finishedAt ?? r.createdAt })),
      ...input.fixEvents
        .filter((e) => e.actorId !== null && fixSpecialist.get(e.fixId) === s.slug)
        .map((e) => ({ actorId: e.actorId, actorRole: role.get(e.actorId as string) ?? null, at: e.at })),
    ]
    return {
      slug: s.slug,
      ownerId: s.ownerId,
      createdAt: s.createdAt,
      scenarioCount: s.scenarios.length,
      holdoutCount: s.scenarios.filter((x) => x.split === "HOLDOUT").length,
      versionCount: s.versions.length,
      runs: runs.map((r) => ({ createdAt: r.createdAt, finishedAt: r.finishedAt, triggeredBy: r.triggeredBy })),
      fixes: fixes.map((f) => ({ id: f.id, status: f.status, verifiedAt: f.verifiedAt })),
      acts,
      // Seeded timings are illustrative, so a specialist with sample runs counts as sample.
      isSample: s.isSample || runs.some((r) => r.isSample),
    }
  })
}

/** Facts for every specialist, oldest first. */
export async function loadOnboardingFacts(db: OnboardingDb): Promise<OnboardingFacts[]> {
  const [specialists, runs, fixes, fixEvents, users] = await Promise.all([
    db.specialist.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        slug: true,
        ownerId: true,
        createdAt: true,
        isSample: true,
        scenarios: { select: { split: true } },
        versions: { select: { id: true } },
        events: { select: { actorId: true, actorRole: true, createdAt: true } },
      },
    }),
    db.evalRun.findMany({ select: { specialistId: true, createdAt: true, finishedAt: true, triggeredBy: true, isSample: true } }),
    db.fix.findMany({ select: { id: true, status: true, verifiedAt: true, failureMode: { select: { specialistId: true } } } }),
    db.fixEvent.findMany({ select: { fixId: true, actorId: true, at: true } }),
    db.user.findMany({ select: { id: true, role: true } }),
  ])
  return buildFacts({ specialists, runs, fixes, fixEvents, users })
}
