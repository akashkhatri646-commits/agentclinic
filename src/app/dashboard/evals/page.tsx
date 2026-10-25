import { auth } from "@/lib/auth"
import { canViewEvals } from "@/lib/guards"
import { getEvalRuns } from "@/lib/evals/queries"
import { isJudgeConfigured } from "@/lib/evals/judge"
import { INTAKE_TRIAGE_ID, listVersions } from "@/lib/evals/specialists"
import { EVAL_ERROR_MESSAGES, isEvalErrorCode } from "@/lib/evals/start"
import { formatPercent, rate } from "@/lib/evals/verdict"
import { redirect } from "next/navigation"
import Link from "next/link"
import EmptyState from "@/components/EmptyState"
import { runEvalAction } from "./actions"

export const metadata = { title: "Evals — AgentClinic" }

function VerdictBadge({ verdict }: { verdict: string }) {
  return <span className={`badge badge-verdict-${verdict.toLowerCase()}`}>{verdict}</span>
}

function source(triggeredBy: string | null): string {
  if (triggeredBy === "seed" || triggeredBy === "cli") return triggeredBy
  return "app"
}

export default async function EvalsPage({ searchParams }: { searchParams: { error?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewEvals(session.user.role)) redirect("/dashboard")

  const runs = await getEvalRuns(INTAKE_TRIAGE_ID)
  const versions = listVersions(INTAKE_TRIAGE_ID)
  const latest = versions[versions.length - 1]
  const judgeAvailable = isJudgeConfigured()
  // Only known error codes map to a message; any other query text is ignored.
  const error = isEvalErrorCode(searchParams.error) ? EVAL_ERROR_MESSAGES[searchParams.error] : null

  return (
    <article>
      <header>
        <div>
          <h2>Evals</h2>
          <p>
            Test the Intake Triage specialist against golden scenarios and read the quality verdict.
          </p>
        </div>
      </header>

      {error && (
        <p role="alert">
          <small style={{ color: "var(--pico-del-color)" }}>{error}</small>
        </p>
      )}

      <section aria-labelledby="run-heading">
        <h3 id="run-heading">Run an eval</h3>
        <form action={runEvalAction}>
          <label>
            Specialist version
            <select name="version" defaultValue={latest?.version} required>
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version}
                </option>
              ))}
            </select>
          </label>
          {judgeAvailable && (
            <label>
              <input type="checkbox" name="judge" />
              Also score rationales with the LLM judge
            </label>
          )}
          <button type="submit">Run eval</button>
        </form>
        <details>
          <summary>What changed between versions</summary>
          <ul>
            {versions.map((v) => (
              <li key={v.version}>
                <strong>{v.version}</strong>: {v.summary}
              </li>
            ))}
          </ul>
        </details>
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
                    <td>
                      <VerdictBadge verdict={r.verdict} />
                    </td>
                    <td>{formatPercent(rate(r.devPassed, r.devTotal))}</td>
                    <td>{formatPercent(rate(r.holdoutPassed, r.holdoutTotal))}</td>
                    <td>{source(r.triggeredBy)}</td>
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
