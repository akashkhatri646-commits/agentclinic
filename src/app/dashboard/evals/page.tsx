import { auth } from "@/lib/auth"
import { canImportOutputs, canViewEvals } from "@/lib/guards"
import { getEvalRuns } from "@/lib/evals/queries"
import { isJudgeConfigured } from "@/lib/evals/judge"
import { listInstances } from "@/lib/evals/instances"
import { pickSpecialist, withSpecialist } from "@/lib/evals/picker"
import { listSpecialists, loadSpecialist } from "@/lib/evals/specialist-store"
import { ALL_INSTANCES, EVAL_ERROR_MESSAGES, isEvalErrorCode } from "@/lib/evals/start"
import { formatPercent, rate } from "@/lib/evals/verdict"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import EmptyState from "@/components/EmptyState"
import SpecialistPicker from "@/components/SpecialistPicker"
import { runEvalAction } from "./actions"

export const metadata = { title: "Evals — AgentClinic" }

function VerdictBadge({ verdict }: { verdict: string }) {
  return <span className={`badge badge-verdict-${verdict.toLowerCase()}`}>{verdict}</span>
}

/** Sample runs have illustrative timings, so say so; otherwise show where the run came from. */
function source(run: { triggeredBy: string | null; isSample: boolean }): string {
  if (run.isSample) return "sample"
  if (run.triggeredBy === "seed" || run.triggeredBy === "cli") return run.triggeredBy
  return "app"
}

export default async function EvalsPage({
  searchParams,
}: {
  searchParams: { error?: string; specialist?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewEvals(session.user.role)) redirect("/dashboard")

  const specialists = await listSpecialists(prisma)
  const selected = pickSpecialist(specialists, searchParams.specialist)
  // Only known error codes map to a message; any other query text is ignored.
  const error = isEvalErrorCode(searchParams.error) ? EVAL_ERROR_MESSAGES[searchParams.error] : null

  if (!selected) {
    return (
      <article>
        <header>
          <h2>Evals</h2>
        </header>
        <EmptyState message="No specialists yet. Create one, or, on a database from before Phase 10, run npm run db:upgrade." />
        <Link href="/dashboard/specialists/new" role="button">
          Create a specialist
        </Link>
      </article>
    )
  }

  const [loaded, instances, runs] = await Promise.all([
    loadSpecialist(prisma, selected.slug),
    listInstances(prisma),
    getEvalRuns(selected.slug),
  ])
  const versions = loaded?.versions ?? []
  const runnable = versions.filter((v) => v.builtinKey)
  const latest = runnable[runnable.length - 1]
  const judgeAvailable = isJudgeConfigured() && Boolean(loaded?.spec.judge)
  const canImport =
    canImportOutputs(session.user.role, session.user.id, selected.ownerId)
  const instanceName = new Map(instances.map((i) => [i.slug, i.name]))

  return (
    <article>
      <header>
        <div>
          <h2>Evals</h2>
          <p>Test {selected.name} against golden scenarios and read the quality verdict.</p>
        </div>
      </header>

      <SpecialistPicker specialists={specialists} selected={selected.slug} />

      {error && (
        <p role="alert">
          <small style={{ color: "var(--pico-del-color)" }}>{error}</small>
        </p>
      )}

      <section aria-labelledby="run-heading">
        <h3 id="run-heading">Run an eval</h3>
        {runnable.length > 0 ? (
          <form action={runEvalAction}>
            <input type="hidden" name="specialist" value={selected.slug} />
            <label>
              Specialist version
              <select name="version" defaultValue={latest?.label} required>
                {runnable.map((v) => (
                  <option key={v.label} value={v.label}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Customer instance
              <select name="instance" defaultValue={instances[0]?.slug} required>
                {instances.map((i) => (
                  <option key={i.slug} value={i.slug}>
                    {i.name} ({i.shape})
                  </option>
                ))}
                <option value={ALL_INSTANCES}>All instances, one run each</option>
              </select>
            </label>
            {judgeAvailable && (
              <label>
                <input type="checkbox" name="judge" />
                Also score answers with the LLM judge
              </label>
            )}
            <button type="submit">Run eval</button>
          </form>
        ) : (
          <p>
            <small>
              This specialist does not run from code. Import what it returned to get a verdict.
            </small>
          </p>
        )}
        {canImport && (
          <p>
            <Link href={withSpecialist(`/dashboard/specialists/${selected.slug}/import`, null)} role="button" className="outline">
              Import outputs
            </Link>
          </p>
        )}
        {versions.some((v) => v.summary) && (
          <details>
            <summary>What changed between versions</summary>
            <ul>
              {versions.map((v) => (
                <li key={v.label}>
                  <strong>{v.label}</strong>: {v.summary || "No summary."}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby="runs-heading">
        <h3 id="runs-heading">Runs</h3>
        {runs.length === 0 ? (
          <EmptyState message="No eval runs yet. Run one above to get a verdict." />
        ) : (
          <figure>
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Instance</th>
                  <th>Verdict</th>
                  <th>Dev</th>
                  <th>Hold-out</th>
                  <th>Source</th>
                  <th>Run</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.version}</td>
                    <td>{instanceName.get(r.instanceSlug) ?? r.instanceSlug}</td>
                    <td>
                      <VerdictBadge verdict={r.verdict} />
                    </td>
                    <td>{formatPercent(rate(r.devPassed, r.devTotal))}</td>
                    <td>{formatPercent(rate(r.holdoutPassed, r.holdoutTotal))}</td>
                    <td>{source(r)}</td>
                    <td>
                      {r.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td>
                      <Link href={`/dashboard/evals/${r.id}`} role="button" className="outline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        )}
      </section>
    </article>
  )
}
