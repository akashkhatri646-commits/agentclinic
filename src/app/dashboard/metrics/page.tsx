import { auth } from "@/lib/auth"
import { canViewEvals } from "@/lib/guards"
import { getRunsForMetrics, getVersionLabels } from "@/lib/evals/queries"
import { listInstances } from "@/lib/evals/instances"
import { pickSpecialist, withSpecialist } from "@/lib/evals/picker"
import { listSpecialists } from "@/lib/evals/specialist-store"
import { prisma } from "@/lib/prisma"
import SpecialistPicker from "@/components/SpecialistPicker"
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
import { computeAdoption, summariseOnboarding } from "@/lib/evals/onboarding"
import { loadOnboardingFacts } from "@/lib/evals/onboarding-queries"

export const metadata = { title: "Metrics — AgentClinic" }

const na = "n/a"

/** Dates are shown in UTC so the same run reads the same wherever the server runs. */
function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" }) : "unknown"
}

const duration = (ms: number | null) => (ms === null ? na : formatDuration(ms))
const count = (n: number | null) => (n === null ? na : String(n))
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export default async function MetricsPage({ searchParams }: { searchParams: { specialist?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewEvals(session.user.role)) redirect("/dashboard")

  const specialists = await listSpecialists(prisma)
  const selected = pickSpecialist(specialists, searchParams.specialist)
  if (!selected) {
    return (
      <article>
        <header>
          <h2>Metrics</h2>
        </header>
        <EmptyState message="No specialists yet, so there is nothing to measure." actionHref="/dashboard/specialists/new" actionLabel="Create a specialist" />
      </article>
    )
  }
  const [runs, labels, instances, facts] = await Promise.all([
    getRunsForMetrics(selected.slug),
    getVersionLabels(selected.slug),
    listInstances(prisma),
    loadOnboardingFacts(prisma),
  ])
  const adoption = computeAdoption(facts.map(summariseOnboarding))
  const versions = labels.map((version) => ({ version }))
  const metrics = buildMetrics(runs, versions)
  const instanceName = new Map(instances.map((i) => [i.slug, i.name]))
  const considered = metrics.instancesConsidered.map((slug) => instanceName.get(slug) ?? slug)
  const comparisons = metrics.versions.filter((v) => v.fixed !== null).length

  return (
    <article>
      <header>
        <div>
          <h2>Metrics</h2>
          <p>How quickly a shipped change gets a quality verdict, and how quality moves from version to version.</p>
        </div>
      </header>

      <SpecialistPicker specialists={specialists} selected={selected.slug} />

      {runs.length === 0 ? (
        <EmptyState
          message="No eval runs yet, so there is nothing to measure. Run an eval to get the first numbers."
          actionHref={withSpecialist("/dashboard/evals", selected.slug)}
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

          {considered.length > 1 && (
            <p>
              <small>
                Pass rates, scenarios fixed and regressions are the worst case across {considered.join(", ")}: a scenario
                counts as passing only if it passes on every one of them. Loop time is unaffected.
              </small>
            </p>
          )}

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

      <section aria-labelledby="adoption-heading">
        <h3 id="adoption-heading">Adoption across all specialists</h3>
        {adoption.sampleSpecialists > 0 && (
          <aside className="sample-notice" role="note" aria-label="Sample data notice">
            <strong>Includes sample data.</strong> {adoption.sampleSpecialists} of {adoption.specialists} specialists are
            illustrative: their dates and who helped them were made up. Specialists you create yourself are real.
          </aside>
        )}
        <div className="metric-grid">
          <div className="stat-tile">
            <p className="stat-label">Specialists</p>
            <p className="stat-value">{adoption.specialists}</p>
            <p>
              <small>{adoption.withVerdict} have reached a verdict</small>
            </p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Fully onboarded</p>
            <p className="stat-value">{adoption.onboarded}</p>
            <p>
              <small>A verdict and a fix verified by a later run</small>
            </p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Unassisted</p>
            <p className="stat-value">{adoption.unassistedShare === null ? na : formatPercent(adoption.unassistedShare)}</p>
            <p>
              <small>
                {adoption.unassisted} of {adoption.onboarded} onboarded. Unassisted means no admin other than the owner acted
                before the first verified fix.
              </small>
            </p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Median time to first verdict</p>
            <p className="stat-value">{duration(adoption.medianMsToFirstVerdict)}</p>
            <p>
              <small>From creating the specialist to its first verdict</small>
            </p>
          </div>
        </div>
        <small>
          Unassisted is a proxy for teams running the loop on their own. <Link href="/dashboard/specialists">See the specialists</Link>.
        </small>
      </section>
    </article>
  )
}
