import { auth } from "@/lib/auth"
import { canManageSpecialist, canViewSpecialists } from "@/lib/guards"
import { formatDateTimeUtc, formatDateUtc } from "@/lib/evals/format"
import { summariseOnboarding } from "@/lib/evals/onboarding"
import { loadOnboardingFacts } from "@/lib/evals/onboarding-queries"
import { describeCheck, describeSpecialistEvent } from "@/lib/evals/spec-view"
import { loadSpecialist } from "@/lib/evals/specialist-store"
import { withSpecialist } from "@/lib/evals/picker"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"

export const metadata = { title: "Specialist — AgentClinic" }

export default async function SpecialistPage({ params }: { params: { slug: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewSpecialists(session.user.role)) redirect("/dashboard")

  const loaded = await loadSpecialist(prisma, params.slug)
  if (!loaded) notFound()
  const { spec } = loaded

  const [owner, events, facts] = await Promise.all([
    prisma.user.findUnique({ where: { id: loaded.ownerId }, select: { email: true } }),
    prisma.specialistEvent.findMany({
      where: { specialistId: loaded.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    loadOnboardingFacts(prisma),
  ])
  const actorIds = Array.from(new Set(events.map((e) => e.actorId).filter((a): a is string => !!a)))
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } }) : []
  const actorEmail = new Map(actors.map((a) => [a.id, a.email]))
  const progress = summariseOnboarding(facts.find((f) => f.slug === spec.slug) ?? facts[0])
  const canManage = canManageSpecialist(session.user.role, session.user.id, loaded.ownerId)
  const themeLabel = new Map(spec.themes.map((t) => [t.id, t.label]))
  const isSample = loaded.isSample || progress.isSample

  return (
    <article>
      <header>
        <div>
          <h2>{spec.name}</h2>
          <p>
            {spec.description || "No description."} Owned by {owner?.email ?? "a removed user"}.{" "}
            {isSample && <span className="badge badge-flag">Sample</span>}
          </p>
        </div>
        <Link href="/dashboard/specialists" role="button" className="outline">
          ← Back
        </Link>
      </header>

      {isSample && (
        <aside className="sample-notice" role="note" aria-label="Sample data notice">
          <strong>Includes sample data.</strong> This specialist&apos;s dates and activity are illustrative. Its scenario
          results are real.
        </aside>
      )}

      <div className="fix-actions">
        {canManage && (
          <>
            <Link href={`/dashboard/specialists/${spec.slug}/edit`} role="button" className="outline">
              Edit definition
            </Link>
            <Link href={`/dashboard/specialists/${spec.slug}/import`} role="button">
              Import outputs
            </Link>
          </>
        )}
        <Link href={withSpecialist("/dashboard/onboarding", spec.slug)} role="button" className="outline">
          Onboarding ({progress.doneCount} of {progress.steps.length})
        </Link>
        <Link href={withSpecialist("/dashboard/evals", spec.slug)} role="button" className="outline">
          Evals
        </Link>
        <Link href={withSpecialist("/dashboard/triage", spec.slug)} role="button" className="outline">
          Triage
        </Link>
      </div>
      {!canManage && (
        <p>
          <small>Only the owner or an admin can change this specialist or import its outputs. You can look at everything.</small>
        </p>
      )}

      <section aria-labelledby="fields-heading">
        <h3 id="fields-heading">What it returns, and how it is checked</h3>
        <figure>
          <table className="metrics-table">
            <caption className="visually-hidden">Output fields</caption>
            <thead>
              <tr>
                <th scope="col">Output field</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {spec.outputFields.map((f) => (
                <tr key={f.name}>
                  <th scope="row">{f.name}</th>
                  <td className="wrap-cell">{f.description || "No description."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
        <ul>
          {spec.checks.map((c, i) => (
            <li key={i}>{describeCheck(c)}</li>
          ))}
          {spec.judge && <li>{spec.judge.field} can also be scored by the LLM judge when it is switched on</li>}
        </ul>
      </section>

      <section aria-labelledby="versions-heading">
        <h3 id="versions-heading">Versions ({loaded.versions.length})</h3>
        {loaded.versions.length === 0 ? (
          <p>
            <em>No version yet. Import the outputs of a first version to get a verdict.</em>
          </p>
        ) : (
          <figure>
            <table className="metrics-table">
              <caption className="visually-hidden">Versions in release order</caption>
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Released (UTC)</th>
                  <th scope="col">Outputs</th>
                  <th scope="col">What changed</th>
                </tr>
              </thead>
              <tbody>
                {loaded.versions.map((v) => (
                  <tr key={v.label}>
                    <th scope="row">{v.label}</th>
                    <td>{formatDateUtc(v.releasedAt)}</td>
                    <td>{v.builtinKey ? "Runs from code" : "Imported"}</td>
                    <td className="wrap-cell">{v.summary || "No summary."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        )}
      </section>

      <section aria-labelledby="themes-heading">
        <h3 id="themes-heading">Scenarios ({spec.scenarios.length})</h3>
        <p>
          <small>
            {spec.scenarios.filter((s) => s.split === "DEV").length} dev, {spec.scenarios.filter((s) => s.split === "HOLDOUT").length} hold-out,
            in {spec.themes.length} themes. Weight is how much a failure matters (1 low, 3 high).
          </small>
        </p>
        <details>
          <summary>Show every scenario</summary>
          <figure>
            <table className="metrics-table">
              <caption className="visually-hidden">Golden scenarios</caption>
              <thead>
                <tr>
                  <th scope="col">Scenario</th>
                  <th scope="col">Set</th>
                  <th scope="col">Theme</th>
                  <th scope="col">Weight</th>
                  <th scope="col">Expected</th>
                  <th scope="col">Input</th>
                </tr>
              </thead>
              <tbody>
                {spec.scenarios.map((s) => (
                  <tr key={s.id}>
                    <th scope="row">{s.id}</th>
                    <td>{s.split.toLowerCase()}</td>
                    <td>{themeLabel.get(s.theme) ?? s.theme}</td>
                    <td>{s.weight}</td>
                    <td className="wrap-cell">{Object.entries(s.expected).map(([k, v]) => `${k} ${v}`).join(", ")}</td>
                    <td className="wrap-cell">{s.input}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        </details>
      </section>

      <section aria-labelledby="activity-heading">
        <h3 id="activity-heading">Activity</h3>
        {events.length === 0 ? (
          <p>
            <em>Nothing recorded yet.</em>
          </p>
        ) : (
          <ol className="history-list">
            {events.map((e) => (
              <li key={e.id}>
                <small>
                  {formatDateTimeUtc(e.createdAt)} UTC · {e.actorId ? actorEmail.get(e.actorId) ?? "a removed user" : "System"}
                  {e.isSample && " · sample"}
                </small>
                <br />
                {describeSpecialistEvent(e.type)}
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  )
}
