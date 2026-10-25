import { auth } from "@/lib/auth"
import { canViewTriage } from "@/lib/guards"
import { formatDateTimeUtc, formatDateUtc } from "@/lib/evals/format"
import { INTAKE_TRIAGE_ID } from "@/lib/evals/specialists"
import { isTriageErrorCode, TRIAGE_ERROR_MESSAGES } from "@/lib/evals/triage-errors"
import { getBacklog } from "@/lib/evals/triage-queries"
import { EFFORT_LABEL, SEVERITY_LABEL, type Level } from "@/lib/evals/triage"
import type { BacklogItem } from "@/lib/evals/triage-view"
import { redirect } from "next/navigation"
import Link from "next/link"
import EmptyState from "@/components/EmptyState"

export const metadata = { title: "Triage — AgentClinic" }

function Flags({ item }: { item: BacklogItem }) {
  const flags: string[] = []
  if (item.reappeared) flags.push("Reappeared after being fixed")
  if (item.regressedScenarioIds.length > 0) {
    const n = item.regressedScenarioIds.length
    flags.push(`${n} regressed ${n === 1 ? "scenario" : "scenarios"}`)
  }
  if (flags.length === 0) return <>None</>
  return (
    <>
      {flags.map((f) => (
        <span key={f} className="badge badge-flag">
          {f}
        </span>
      ))}
    </>
  )
}

export default async function TriagePage({ searchParams }: { searchParams: { error?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewTriage(session.user.role)) redirect("/dashboard")

  const backlog = await getBacklog(INTAKE_TRIAGE_ID)
  // Only known error codes map to a message; any other query text is ignored.
  const error = isTriageErrorCode(searchParams.error) ? TRIAGE_ERROR_MESSAGES[searchParams.error] : null
  const { summary } = backlog

  return (
    <article>
      <header>
        <div>
          <h2>Triage</h2>
          <p>
            Failing scenarios, grouped into failure modes and ranked so the most valuable fix comes first.
            Priority = frequency × severity ÷ effort.
          </p>
        </div>
      </header>

      {error && (
        <p role="alert">
          <small style={{ color: "var(--pico-del-color)" }}>{error}</small>
        </p>
      )}

      {!backlog.reflects ? (
        <EmptyState
          message="No eval runs yet, so there is nothing to triage. Run an eval to find failure modes."
          actionHref="/dashboard/evals"
          actionLabel="Go to Evals"
        />
      ) : (
        <>
          <p>
            <small>
              Reflects the latest <strong>{backlog.reflects.version}</strong> run, {formatDateTimeUtc(backlog.reflects.at)} UTC.
              Re-running an older version does not change it.
            </small>
          </p>

          {backlog.hasSampleFixes && (
            <aside className="sample-notice" role="note" aria-label="Sample data notice">
              <strong>Includes sample data.</strong> Some fixes below, with their owners and dates, are illustrative:
              they were made up to show the lifecycle. The failure modes, scores and verifications come from real eval
              runs.
            </aside>
          )}

          <section aria-labelledby="summary-heading">
            <h3 id="summary-heading" className="visually-hidden">
              Summary
            </h3>
            <div className="metric-grid metric-grid-compact">
              <div className="stat-tile">
                <p className="stat-label">Open failure modes</p>
                <p className="stat-value">{summary.openModes}</p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Failing scenarios</p>
                <p className="stat-value">{summary.failingScenarios}</p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Fixes in flight</p>
                <p className="stat-value">{summary.fixesInFlight}</p>
                <p>
                  <small>In progress, or shipped and not yet verified</small>
                </p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Verified fixes</p>
                <p className="stat-value">{summary.verifiedFixes}</p>
                <p>
                  <small>Proven by a later run</small>
                </p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Flagged</p>
                <p className="stat-value">{summary.flagged}</p>
                <p>
                  <small>Reappeared or regressed</small>
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="backlog-heading">
            <h3 id="backlog-heading">Fix backlog ({backlog.open.length})</h3>
            {backlog.open.length === 0 ? (
              <p>
                <em>Nothing is failing in the current state. Every failure mode is resolved.</em>
              </p>
            ) : (
              <figure>
                <table className="metrics-table">
                  <caption className="visually-hidden">
                    Open failure modes ranked by priority score, highest first
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Failure mode</th>
                      <th scope="col">Failing</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Effort</th>
                      <th scope="col">Score</th>
                      <th scope="col">Fixes</th>
                      <th scope="col">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backlog.open.map((m, i) => (
                      <tr key={m.id}>
                        <td>{i + 1}</td>
                        <th scope="row">
                          <Link href={`/dashboard/triage/${m.id}`}>{m.label}</Link>
                        </th>
                        <td>
                          {m.frequency} of {m.totalScenarios}
                        </td>
                        <td>
                          {SEVERITY_LABEL[m.severity as Level]}
                          {m.severityOverride !== null && <small> (set by staff)</small>}
                        </td>
                        <td>{EFFORT_LABEL[m.effort as Level] ?? m.effort}</td>
                        <td>
                          <strong>{m.score.toFixed(1)}</strong>
                        </td>
                        <td>{m.fixSummary}</td>
                        <td>
                          <Flags item={m} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </figure>
            )}
          </section>

          {backlog.resolved.length > 0 && (
            <section aria-labelledby="resolved-heading">
              <h3 id="resolved-heading">Resolved ({backlog.resolved.length})</h3>
              <figure>
                <table className="metrics-table">
                  <caption className="visually-hidden">Failure modes with no failing scenarios in the current state</caption>
                  <thead>
                    <tr>
                      <th scope="col">Failure mode</th>
                      <th scope="col">Resolved (UTC)</th>
                      <th scope="col">Fixes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backlog.resolved.map((m) => (
                      <tr key={m.id}>
                        <th scope="row">
                          <Link href={`/dashboard/triage/${m.id}`}>{m.label}</Link>
                        </th>
                        <td>{formatDateUtc(m.resolvedAt)}</td>
                        <td>{m.fixSummary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </figure>
            </section>
          )}
        </>
      )}
    </article>
  )
}
