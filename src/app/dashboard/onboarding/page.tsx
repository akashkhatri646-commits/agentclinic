import { auth } from "@/lib/auth"
import { canViewSpecialists } from "@/lib/guards"
import { summariseOnboarding } from "@/lib/evals/onboarding"
import { loadOnboardingFacts } from "@/lib/evals/onboarding-queries"
import { pickSpecialist } from "@/lib/evals/picker"
import { listSpecialists } from "@/lib/evals/specialist-store"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import EmptyState from "@/components/EmptyState"
import SpecialistPicker from "@/components/SpecialistPicker"

export const metadata = { title: "Onboarding — AgentClinic" }

export default async function OnboardingPage({ searchParams }: { searchParams: { specialist?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewSpecialists(session.user.role)) redirect("/dashboard")

  const specialists = await listSpecialists(prisma)
  const selected = pickSpecialist(specialists, searchParams.specialist)

  if (!selected) {
    return (
      <article>
        <header>
          <h2>Onboarding</h2>
        </header>
        <EmptyState
          message="Nothing to onboard yet. Create a specialist from a template and this page will track your progress."
          actionHref="/dashboard/specialists/new"
          actionLabel="New specialist"
        />
      </article>
    )
  }

  const facts = (await loadOnboardingFacts(prisma)).find((f) => f.slug === selected.slug)
  const progress = facts ? summariseOnboarding(facts) : null
  const next = progress?.steps.find((s) => !s.done)

  return (
    <article>
      <header>
        <div>
          <h2>Onboarding</h2>
          <p>
            Get {selected.name} through the loop: from a config to a verdict to a fix that a later run proves. Each step ticks
            itself from what you have actually done.
          </p>
        </div>
      </header>

      <SpecialistPicker specialists={specialists} selected={selected.slug} />

      {progress && (
        <>
          <p>
            <strong>
              {progress.onboarded ? "Onboarded." : `${progress.doneCount} of ${progress.steps.length} steps done.`}
            </strong>{" "}
            {progress.onboarded
              ? "It has a verdict and a verified fix."
              : next
                ? `Next: ${next.title.toLowerCase()}.`
                : "Every step is done, but no fix has been verified by a run yet."}
            {progress.isSample && (
              <>
                {" "}
                <span className="badge badge-flag">Sample</span>
              </>
            )}
          </p>

          <ol className="step-list" aria-label="Onboarding steps">
            {progress.steps.map((s, i) => (
              <li key={s.id}>
                <h3>
                  {i + 1}. {s.title}
                </h3>
                <p>
                  <span className="step-status">{s.done ? "Done" : "Not done"}</span> {s.done ? null : s.detail}
                </p>
                <p>
                  <small>{s.guidance}</small>
                </p>
                {!s.done && s.href && (
                  <Link href={s.href} role="button" className="outline">
                    {s.id === "scenarios" ? "Edit the definition" : s.id === "version" ? "Import outputs" : s.id === "verdict" ? "Go to Evals" : "Go to Triage"}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      <p>
        <small>
          Stuck? The playbook in the repository (<code>docs/playbook.md</code>) walks through each step, with the common
          validation errors.
        </small>
      </p>
    </article>
  )
}
