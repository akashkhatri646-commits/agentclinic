import { auth } from "@/lib/auth"
import { canViewEvals } from "@/lib/guards"
import { getRunsForMetrics } from "@/lib/evals/queries"
import { INTAKE_TRIAGE_ID, listVersions } from "@/lib/evals/specialists"
import {
  LOOP_TIME_TARGET_LABEL,
  buildMetrics,
  formatDuration,
  targetStatus,
} from "@/lib/evals/metrics"
import { formatPercent } from "@/lib/evals/verdict"
import { redirect } from "next/navigation"
import Link from "next/link"
import EmptyState from "@/components/EmptyState"
import PassRateChart from "@/components/PassRateChart"

export const metadata = { title: "Metrics — AgentClinic" }

const na = "n/a"

/** Dates are shown in UTC so the same run reads the same wherever the server runs. */
function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" }) : "unknown"
}

const duration = (ms: number | null) => (ms === null ? na : formatDuration(ms))
const count = (n: number | null) => (n === null ? na : String(n))
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export default async function MetricsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewEvals(session.user.role)) redirect("/dashboard")

  const runs = await getRunsForMetrics(INTAKE_TRIAGE_ID)
  const versions = listVersions(INTAKE_TRIAGE_ID).map((v) => ({ version: v.version }))
  const metrics = buildMetrics(runs, versions)
  const comparisons = metrics.versions.filter((v) => v.fixed !== null).length

  return (
    <article>
      <header>
        <div>
          <h2>Metrics</h2>
          <p>How quickly a shipped change gets a quality verdict, and how quality moves from version to version.</p>
        </div>
      </header>

      {runs.length === 0 ? (
        <EmptyState
          message="No eval runs yet, so there is nothing to measure. Run an eval to get the first numbers."
          actionHref="/dashboard/evals"
          actionLabel="Go to Evals"
        />
      ) : (
        <>
          {metrics.includesSample && (
            <aside className="sample-notice" role="note" aria-label="Sample data notice">
              <strong>Includes sample data.</strong> The timings of the seeded runs are illustrative: they were
              made up to show what these metrics look like. The scenario results, pass rates and comparisons
              are real. Runs you start yourself are real and are never marked as sample.
            </aside>
          )}

          <section aria-labelledby="headline-heading">
            <h3 id="headline-heading">Loop time</h3>
            <div className="metric-grid">
              <div className="stat-tile">
                <p className="stat-label">Median loop time</p>
                <p className="stat-value">{duration(metrics.medianLoopMs)}</p>
                <p>
                  <small>
                    Target: under {LOOP_TIME_TARGET_LABEL}. <strong>{targetStatus(metrics.withinTarget)}</strong>.
                  </small>
                </p>
                <p>
                  <small>Across {plural(metrics.versionsWithLoop, "version")}.</small>
                </p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Baseline</p>
                <p className="stat-value">{duration(metrics.baselineMs)}</p>
                <p>
                  <small>{metrics.baselineVersion ? `First version (${metrics.baselineVersion})` : "No data"}</small>
                </p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Latest</p>
                <p className="stat-value">{duration(metrics.latestMs)}</p>
                <p>
                  <small>{metrics.latestVersion ? `Latest version (${metrics.latestVersion})` : "No data"}</small>
                </p>
              </div>
            </div>
            <small>
              Loop time is the time from a version shipping to its first quality verdict. A later re-run does not
              change it.
            </small>
            {metrics.excludedRuns > 0 && (
              <p>
                <small>
                  {plural(metrics.excludedRuns, "run")} left out of loop time because the run has no release
                  time or no verdict time (for example runs from before this was recorded).
                </small>
              </p>
            )}
          </section>

          <section aria-labelledby="quality-heading">
            <h3 id="quality-heading">Quality across versions</h3>
            <div className="metric-grid">
              <div className="stat-tile">
                <p className="stat-label">Scenarios fixed</p>
                <p className="stat-value">{metrics.fixedTotal}</p>
                <p>
                  <small>Newly passing, across {plural(comparisons, "version change")}.</small>
                </p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Regressions detected</p>
                <p className="stat-value">{metrics.regressedTotal}</p>
                <p>
                  <small>Newly failing, across {plural(comparisons, "version change")}.</small>
                </p>
              </div>
            </div>
            <PassRateChart
              versions={metrics.versions
                .filter((v) => v.runCount > 0)
                .map((v) => ({ version: v.version, dev: v.devRate, holdout: v.holdoutRate }))}
            />
          </section>

          <section aria-labelledby="table-heading">
            <h3 id="table-heading">By version</h3>
            <figure>
              <table className="metrics-table">
                <caption className="visually-hidden">
                  Loop time, pass rates, scenarios fixed and regressions detected for each specialist version
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Version</th>
                    <th scope="col">Shipped (UTC)</th>
                    <th scope="col">Waiting</th>
                    <th scope="col">Running</th>
                    <th scope="col">Loop time</th>
                    <th scope="col">Dev</th>
                    <th scope="col">Hold-out</th>
                    <th scope="col">Fixed</th>
                    <th scope="col">Regressed</th>
                    <th scope="col">Runs</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.versions.map((v) => (
                    <tr key={v.version}>
                      <th scope="row">{v.version}</th>
                      <td>{v.runCount === 0 ? na : fmtDate(v.shippedAt)}</td>
                      <td>{duration(v.waitingMs)}</td>
                      <td>{duration(v.runningMs)}</td>
                      <td>
                        <strong>{duration(v.loopMs)}</strong>
                      </td>
                      <td>{formatPercent(v.devRate)}</td>
                      <td>{formatPercent(v.holdoutRate)}</td>
                      <td>{count(v.fixed)}</td>
                      <td>{count(v.regressed)}</td>
                      <td>{v.runCount === 0 ? "not yet run" : v.runCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </figure>
            <small>
              Pass rates come from each version&apos;s latest run. Fixed and regressed compare that run with the
              previous version&apos;s latest run, by scenario.{" "}
              <Link href="/dashboard/evals">See the individual runs</Link>.
            </small>
          </section>
        </>
      )}
    </article>
  )
}
