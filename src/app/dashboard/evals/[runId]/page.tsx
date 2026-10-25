import { auth } from "@/lib/auth"
import { canViewEvals } from "@/lib/guards"
import { getEvalRunById, getPreviousVersionRun } from "@/lib/evals/queries"
import { INTAKE_TRIAGE_SCENARIOS } from "@/lib/evals/scenarios/intake-triage"
import { getSpecialistVersion } from "@/lib/evals/specialists"
import {
  DEV_PASS_THRESHOLD,
  MAX_HOLDOUT_GAP,
  compareRuns,
  formatPercent,
  rate,
  summariseFailures,
} from "@/lib/evals/verdict"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"

export const metadata = { title: "Eval Verdict — AgentClinic" }

const descriptions = new Map(INTAKE_TRIAGE_SCENARIOS.map((s) => [s.id, s.description]))

function fmtDate(d: Date) {
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
}

/** "+5.0 pts" / "-2.5 pts" / "n/a" */
function points(delta: number | null): string {
  if (delta === null) return "n/a"
  const value = (delta * 100).toFixed(1)
  return `${delta > 0 ? "+" : ""}${value} pts`
}

function ScenarioList({ ids }: { ids: string[] }) {
  if (ids.length === 0) return <em>None</em>
  return (
    <ul>
      {ids.map((id) => (
        <li key={id}>
          <strong>{id}</strong>: {descriptions.get(id) ?? "Scenario no longer in the set"}
        </li>
      ))}
    </ul>
  )
}

export default async function EvalRunPage({ params }: { params: { runId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewEvals(session.user.role)) redirect("/dashboard")

  const run = await getEvalRunById(params.runId)
  if (!run) notFound()

  const previousRun = await getPreviousVersionRun(run)
  const comparison = previousRun
    ? compareRuns(
        { ...run, results: run.results },
        { ...previousRun, results: previousRun.results }
      )
    : null

  const devRate = rate(run.devPassed, run.devTotal)
  const holdoutRate = rate(run.holdoutPassed, run.holdoutTotal)
  const gap = devRate !== null && holdoutRate !== null ? devRate - holdoutRate : null
  const failures = run.results.filter((r) => !r.passed)
  const byCategory = summariseFailures(run.results)
  const specialist = getSpecialistVersion(run.specialistId, run.version)

  return (
    <article>
      <header>
        <div>
          <h2>Eval Verdict</h2>
          <p>
            {run.specialistId} {run.version} · {fmtDate(run.createdAt)}
          </p>
        </div>
        <Link href="/dashboard/evals" role="button" className="outline">
          ← Back
        </Link>
      </header>

      <section aria-labelledby="verdict-heading" className="verdict-banner">
        <h3 id="verdict-heading">
          Verdict: <span className={`badge badge-verdict-${run.verdict.toLowerCase()}`}>{run.verdict}</span>
        </h3>
        <p>{run.verdictReason}</p>
        <small>
          Pass needs a dev pass rate of at least {formatPercent(DEV_PASS_THRESHOLD)} and a hold-out rate within{" "}
          {(MAX_HOLDOUT_GAP * 100).toFixed(0)} points of dev.
        </small>
      </section>

      <section aria-labelledby="rates-heading">
        <h3 id="rates-heading">Pass rates</h3>
        <figure>
          <table>
            <thead>
              <tr>
                <th>Set</th>
                <th>Passed</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Dev</td>
                <td>
                  {run.devPassed} / {run.devTotal}
                </td>
                <td>{formatPercent(devRate)}</td>
              </tr>
              <tr>
                <td>Hold-out</td>
                <td>
                  {run.holdoutPassed} / {run.holdoutTotal}
                </td>
                <td>{formatPercent(holdoutRate)}</td>
              </tr>
              <tr>
                <td>Gap (dev minus hold-out)</td>
                <td></td>
                <td>{gap === null ? "n/a" : `${(gap * 100).toFixed(1)} pts`}</td>
              </tr>
            </tbody>
          </table>
        </figure>
        <small>
          LLM judge: {run.judgeEnabled ? "enabled" : "disabled"}.
          {specialist && <> Version summary: {specialist.summary}</>}
        </small>
      </section>

      <section aria-labelledby="compare-heading">
        <h3 id="compare-heading">Compared with the previous version</h3>
        {comparison && previousRun ? (
          <>
            <p>
              Against {previousRun.version} ({fmtDate(previousRun.createdAt)}): dev{" "}
              <strong>{points(comparison.devDelta)}</strong>, hold-out{" "}
              <strong>{points(comparison.holdoutDelta)}</strong>.
            </p>
            <h4>Fixed ({comparison.fixed.length})</h4>
            <ScenarioList ids={comparison.fixed} />
            <h4>Regressed ({comparison.regressed.length})</h4>
            <ScenarioList ids={comparison.regressed} />
          </>
        ) : (
          <p>
            <em>
              {run.version === "v1"
                ? "This is the first version, so there is nothing to compare with."
                : "The previous version has not been run yet, so there is nothing to compare with."}
            </em>
          </p>
        )}
      </section>

      <section aria-labelledby="failures-heading">
        <h3 id="failures-heading">Failures by category</h3>
        {byCategory.length === 0 ? (
          <p>
            <em>No failures.</em>
          </p>
        ) : (
          <figure>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((c) => (
                  <tr key={c.category}>
                    <td>{c.category.replace(/_/g, " ").toLowerCase()}</td>
                    <td>{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        )}
      </section>

      {failures.length > 0 && (
        <section aria-labelledby="failed-heading">
          <h3 id="failed-heading">Failed scenarios ({failures.length})</h3>
          <figure>
            <table>
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Why it failed</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.scenarioId}</strong> ({r.split.toLowerCase()})
                      <br />
                      <small>{descriptions.get(r.scenarioId)}</small>
                    </td>
                    <td>
                      {r.expectedSeverity}
                      <br />
                      <small>{r.expectedTherapy}</small>
                    </td>
                    <td>
                      {r.actualSeverity}
                      <br />
                      <small>{r.actualTherapy}</small>
                    </td>
                    <td>
                      {r.reason}
                      {r.judgeNote && (
                        <>
                          <br />
                          <small>Judge: {r.judgeNote}</small>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        </section>
      )}

      <details>
        <summary>All {run.results.length} scenario results</summary>
        <figure>
          <table>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Set</th>
                <th>Result</th>
                <th>Severity</th>
                <th>Therapy</th>
                <th>Judge</th>
              </tr>
            </thead>
            <tbody>
              {run.results.map((r) => (
                <tr key={r.id}>
                  <td>{r.scenarioId}</td>
                  <td>{r.split.toLowerCase()}</td>
                  <td>{r.passed ? "PASS" : "FAIL"}</td>
                  <td>{r.actualSeverity}</td>
                  <td>{r.actualTherapy}</td>
                  <td>{r.judgeScore === null ? "n/a" : `${r.judgeScore}/5`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      </details>
    </article>
  )
}
