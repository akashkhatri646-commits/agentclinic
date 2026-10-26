import { auth } from "@/lib/auth"
import { canCreateSpecialist, canViewSpecialists } from "@/lib/guards"
import { formatDateUtc } from "@/lib/evals/format"
import { summariseOnboarding } from "@/lib/evals/onboarding"
import { loadOnboardingFacts } from "@/lib/evals/onboarding-queries"
import { listSpecialists } from "@/lib/evals/specialist-store"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import EmptyState from "@/components/EmptyState"

export const metadata = { title: "Specialists — AgentClinic" }

export default async function SpecialistsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewSpecialists(session.user.role)) redirect("/dashboard")

  const [specialists, facts, instanceRuns] = await Promise.all([
    listSpecialists(prisma),
    loadOnboardingFacts(prisma),
    prisma.evalRun.groupBy({ by: ["specialistId", "instanceSlug"] }),
  ])
  const progress = new Map(facts.map((f) => [f.slug, { summary: summariseOnboarding(f), runs: f.runs.length }]))
  const instanceCount = new Map<string, number>()
  for (const r of instanceRuns) instanceCount.set(r.specialistId, (instanceCount.get(r.specialistId) ?? 0) + 1)
  const hasSample = specialists.some((s) => progress.get(s.slug)?.summary.isSample)

  return (
    <article>
      <header>
        <div>
          <h2>Specialists</h2>
          <p>
            The AI specialists being tested. Each has its own scenarios and checks, and anyone on staff can add one by
            pasting a config.
          </p>
        </div>
        {canCreateSpecialist(session.user.role) && (
          <Link href="/dashboard/specialists/new" role="button">
            New specialist
          </Link>
        )}
      </header>

      {hasSample && (
        <aside className="sample-notice" role="note" aria-label="Sample data notice">
          <strong>Includes sample data.</strong> Some specialists below, with their owners, dates and progress, were made
          up to show what a fresh install looks like. Their scenario results are real.
        </aside>
      )}

      {specialists.length === 0 ? (
        <EmptyState message="No specialists yet. Create one from a template to start." actionHref="/dashboard/specialists/new" actionLabel="New specialist" />
      ) : (
        <figure>
          <table className="metrics-table">
            <caption className="visually-hidden">Specialists with their owner, size and onboarding progress</caption>
            <thead>
              <tr>
                <th scope="col">Specialist</th>
                <th scope="col">Owner</th>
                <th scope="col">Scenarios</th>
                <th scope="col">Versions</th>
                <th scope="col">Runs</th>
                <th scope="col">Instances</th>
                <th scope="col">Onboarding</th>
                <th scope="col">Created (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {specialists.map((s) => {
                const p = progress.get(s.slug)
                return (
                  <tr key={s.slug}>
                    <th scope="row">
                      <Link href={`/dashboard/specialists/${s.slug}`}>{s.name}</Link>
                      {s.isSample && <span className="badge badge-flag">Sample</span>}
                    </th>
                    <td>{s.ownerEmail}</td>
                    <td>{s.scenarioCount}</td>
                    <td>{s.versionCount}</td>
                    <td>{p?.runs ?? 0}</td>
                    <td>{instanceCount.get(s.slug) ?? 0}</td>
                    <td>
                      {p ? (
                        <Link href={`/dashboard/onboarding?specialist=${encodeURIComponent(s.slug)}`}>
                          {p.summary.onboarded ? "Onboarded" : `${p.summary.doneCount} of ${p.summary.steps.length} steps`}
                        </Link>
                      ) : (
                        "Unknown"
                      )}
                    </td>
                    <td>{formatDateUtc(s.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </figure>
      )}
    </article>
  )
}
