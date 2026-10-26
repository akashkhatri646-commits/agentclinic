import { median } from "./metrics"

/**
 * Onboarding and adoption, from real data. A team is a specialist's owner. The checklist
 * ticks from what exists (scenarios, versions, runs, fixes); nothing is stored separately,
 * so it cannot disagree with the rest of the app. Pure, so the rules can be tested.
 */

/** A specialist needs at least this many scenarios, and this many hold-out ones, to be worth a verdict. */
export const MIN_SCENARIOS = 6
export const MIN_HOLDOUT = 2

export type StepId = "create" | "scenarios" | "version" | "verdict" | "fix" | "verified"

export type Step = {
  id: StepId
  title: string
  /** Plain words for the person doing it. */
  guidance: string
  done: boolean
  /** Where to do it, when there is a page for it. */
  href: string | null
  /** What is missing, in words, when the step is not done. */
  detail: string | null
}

export type OnboardingFacts = {
  slug: string
  ownerId: string
  createdAt: Date
  scenarioCount: number
  holdoutCount: number
  versionCount: number
  runs: { createdAt: Date; finishedAt: Date | null; triggeredBy: string | null }[]
  fixes: { id: string; status: string; verifiedAt: Date | null }[]
  /** Everything people did to the specialist: events, who started runs, who moved fixes. */
  acts: { actorId: string | null; actorRole: string | null; at: Date }[]
  isSample: boolean
}

const when = (r: { createdAt: Date; finishedAt: Date | null }) => (r.finishedAt ?? r.createdAt).getTime()

/** The first verdict is the earliest run to finish. */
export function firstVerdictAt(facts: Pick<OnboardingFacts, "runs">): Date | null {
  if (facts.runs.length === 0) return null
  return new Date(Math.min(...facts.runs.map(when)))
}

export function firstVerifiedAt(facts: Pick<OnboardingFacts, "fixes">): Date | null {
  const times = facts.fixes.filter((f) => f.status === "VERIFIED").map((f) => (f.verifiedAt ?? new Date(0)).getTime())
  return times.length === 0 ? null : new Date(Math.min(...times))
}

export function onboardingSteps(facts: OnboardingFacts): Step[] {
  const base = `/dashboard/specialists/${encodeURIComponent(facts.slug)}`
  const triage = `/dashboard/triage?specialist=${encodeURIComponent(facts.slug)}`
  const enough = facts.scenarioCount >= MIN_SCENARIOS && facts.holdoutCount >= MIN_HOLDOUT
  const verified = facts.fixes.some((f) => f.status === "VERIFIED")
  const missing: string[] = []
  if (facts.scenarioCount < MIN_SCENARIOS) missing.push(`${MIN_SCENARIOS - facts.scenarioCount} more scenario${MIN_SCENARIOS - facts.scenarioCount === 1 ? "" : "s"}`)
  if (facts.holdoutCount < MIN_HOLDOUT) missing.push(`${MIN_HOLDOUT - facts.holdoutCount} more hold-out scenario${MIN_HOLDOUT - facts.holdoutCount === 1 ? "" : "s"}`)

  return [
    {
      id: "create",
      title: "Create the specialist",
      guidance: "Describe what it returns, how each answer is checked, and its golden scenarios, from a template.",
      done: true,
      href: base,
      detail: null,
    },
    {
      id: "scenarios",
      title: "Write enough scenarios",
      guidance: `Aim for at least ${MIN_SCENARIOS} scenarios, ${MIN_HOLDOUT} of them held out to expose overfitting. Group them into themes: each theme becomes a failure mode.`,
      done: enough,
      href: `${base}/edit`,
      detail: enough ? null : `Needs ${missing.join(" and ")}.`,
    },
    {
      id: "version",
      title: "Import the first version's outputs",
      guidance: "Run your specialist on every scenario elsewhere, then import what it returned with the version label and the time the change shipped.",
      done: facts.versionCount > 0,
      href: `${base}/import`,
      detail: facts.versionCount > 0 ? null : "No version has been registered yet.",
    },
    {
      id: "verdict",
      title: "Read the first verdict",
      guidance: "Open the verdict: pass rates on dev and hold-out, what failed and why, and the time it took.",
      done: facts.runs.length > 0,
      href: "/dashboard/evals",
      detail: facts.runs.length > 0 ? null : "No run has produced a verdict yet.",
    },
    {
      id: "fix",
      title: "Triage the first failure",
      guidance: "Pick the top failure mode, rate its effort, and propose a fix with an owner.",
      done: facts.fixes.length > 0,
      href: triage,
      detail: facts.fixes.length > 0 ? null : "No fix has been proposed yet.",
    },
    {
      id: "verified",
      title: "Verify a fix with a later run",
      guidance: "Mark the fix shipped in the version that contains it, then import that version's outputs. The run verifies the fix automatically when its scenarios pass.",
      done: verified,
      href: triage,
      detail: verified ? null : "No fix has been verified by a run yet.",
    },
  ]
}

export function isOnboarded(facts: OnboardingFacts): boolean {
  return facts.runs.length > 0 && facts.fixes.some((f) => f.status === "VERIFIED")
}

/**
 * Whether an admin other than the owner acted on the specialist before it reached its first
 * verified fix (or at all, if it has not reached one). Creating, changing, importing, running
 * and moving its fixes all count as acting. The owner's own acts never do, even an admin owner's.
 */
export function isAssisted(facts: OnboardingFacts): boolean {
  const cutoff = firstVerifiedAt(facts)
  return facts.acts.some(
    (a) => a.actorRole === "ADMIN" && a.actorId !== null && a.actorId !== facts.ownerId && (cutoff === null || a.at.getTime() <= cutoff.getTime())
  )
}

export type SpecialistOnboarding = {
  slug: string
  steps: Step[]
  doneCount: number
  hasVerdict: boolean
  onboarded: boolean
  assisted: boolean
  isSample: boolean
  msToFirstVerdict: number | null
}

export function summariseOnboarding(facts: OnboardingFacts): SpecialistOnboarding {
  const steps = onboardingSteps(facts)
  const first = firstVerdictAt(facts)
  return {
    slug: facts.slug,
    steps,
    doneCount: steps.filter((s) => s.done).length,
    hasVerdict: facts.runs.length > 0,
    onboarded: isOnboarded(facts),
    assisted: isAssisted(facts),
    isSample: facts.isSample,
    msToFirstVerdict: first ? Math.max(0, first.getTime() - facts.createdAt.getTime()) : null,
  }
}

export type Adoption = {
  specialists: number
  withVerdict: number
  onboarded: number
  /** Of the onboarded specialists, how many no admin other than the owner helped. */
  unassisted: number
  /** unassisted / onboarded, or null when none is onboarded. */
  unassistedShare: number | null
  medianMsToFirstVerdict: number | null
  sampleSpecialists: number
}

export function computeAdoption(list: SpecialistOnboarding[]): Adoption {
  const onboarded = list.filter((s) => s.onboarded)
  const unassisted = onboarded.filter((s) => !s.assisted).length
  return {
    specialists: list.length,
    withVerdict: list.filter((s) => s.hasVerdict).length,
    onboarded: onboarded.length,
    unassisted,
    unassistedShare: onboarded.length === 0 ? null : unassisted / onboarded.length,
    medianMsToFirstVerdict: median(list.flatMap((s) => (s.msToFirstVerdict === null ? [] : [s.msToFirstVerdict]))),
    sampleSpecialists: list.filter((s) => s.isSample).length,
  }
}
