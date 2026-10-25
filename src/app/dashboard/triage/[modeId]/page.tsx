import { auth } from "@/lib/auth"
import { canManageTriage, canViewTriage } from "@/lib/guards"
import { formatDateTimeUtc, formatDateUtc } from "@/lib/evals/format"
import { INTAKE_TRIAGE_ID, listVersions } from "@/lib/evals/specialists"
import { isTriageErrorCode, TRIAGE_ERROR_MESSAGES } from "@/lib/evals/triage-errors"
import { getAssignableOwners, getFailureModeDetail, type FixDetail } from "@/lib/evals/triage-queries"
import { EFFORT_LABEL, SEVERITY_LABEL, nextStatuses, type Level } from "@/lib/evals/triage"
import { FIX_STATUS_LABEL, describeEvent, statusActionLabel } from "@/lib/evals/triage-view"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { changeFixOwnerAction, changeFixStatusAction, createFixAction, updateInputsAction } from "../actions"

export const metadata = { title: "Failure Mode — AgentClinic" }

type Owner = { id: string; email: string; role: string }

function StatusBadge({ fix }: { fix: FixDetail }) {
  return <span className={`badge badge-fix-${fix.status.toLowerCase().replace(/_/g, "-")}`}>{FIX_STATUS_LABEL[fix.status]}</span>
}

function FixCard({
  fix,
  modeId,
  owners,
  versions,
}: {
  fix: FixDetail
  modeId: string
  owners: Owner[]
  versions: string[]
}) {
  const moves = nextStatuses(fix.status)
  return (
    <section className="fix-card" aria-labelledby={`fix-${fix.id}`}>
      <h4 id={`fix-${fix.id}`}>
        {fix.title} <StatusBadge fix={fix} />
        {fix.isSample && <span className="badge badge-sample">Sample</span>}
      </h4>
      {fix.description && <p>{fix.description}</p>}

      <dl>
        <dt>Owner</dt>
        <dd>{fix.ownerEmail ?? <em>No owner</em>}</dd>
        {fix.shippedVersion && (
          <>
            <dt>Shipped in</dt>
            <dd>
              {fix.shippedVersion}
              {fix.shippedAt && <small> ({formatDateUtc(fix.shippedAt)} UTC)</small>}
            </dd>
          </>
        )}
        {fix.status === "VERIFIED" && (
          <>
            <dt>Verified by</dt>
            <dd>
              a {fix.verifiedByVersion ?? "later"} run
              {fix.verifiedAt && <small> ({formatDateTimeUtc(fix.verifiedAt)} UTC)</small>}
            </dd>
          </>
        )}
      </dl>

      {fix.unverified && (
        <p role="note">
          <strong>Not yet verified:</strong> the scenarios of this failure mode still fail. A run of {fix.shippedVersion} or
          later that passes all of them will verify this fix automatically.
        </p>
      )}

      <div className="fix-actions">
        {moves.map((to) => (
          <form key={to} action={changeFixStatusAction}>
            <input type="hidden" name="fixId" value={fix.id} />
            <input type="hidden" name="failureModeId" value={modeId} />
            <input type="hidden" name="to" value={to} />
            {to === "SHIPPED" && (
              <label>
                Shipped in version
                <select name="shippedVersion" required defaultValue={versions[versions.length - 1]}>
                  {versions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit" className="outline">
              {statusActionLabel(fix.status, to)}
            </button>
          </form>
        ))}
        {fix.status === "VERIFIED" && <small>Verified fixes cannot be changed. Only a run can verify a fix.</small>}
      </div>

      <form action={changeFixOwnerAction} className="fix-actions">
        <input type="hidden" name="fixId" value={fix.id} />
        <input type="hidden" name="failureModeId" value={modeId} />
        <label>
          Owner
          <select name="ownerId" defaultValue={fix.ownerId ?? ""}>
            <option value="">No owner</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.email}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="outline">
          Change owner
        </button>
      </form>

      <details>
        <summary>History ({fix.history.length})</summary>
        <ol className="history-list">
          {fix.history.map((e) => (
            <li key={e.id}>
              <small>
                {formatDateTimeUtc(e.at)} UTC · {e.actorEmail ?? "System"}
              </small>
              <br />
              {describeEvent(e)}
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}

export default async function FailureModePage({
  params,
  searchParams,
}: {
  params: { modeId: string }
  searchParams: { error?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewTriage(session.user.role)) redirect("/dashboard")

  const detail = await getFailureModeDetail(params.modeId)
  if (!detail) notFound()

  const canEdit = canManageTriage(session.user.role)
  const owners = canEdit ? await getAssignableOwners() : []
  const versions = listVersions(INTAKE_TRIAGE_ID).map((v) => v.version)
  const error = isTriageErrorCode(searchParams.error) ? TRIAGE_ERROR_MESSAGES[searchParams.error] : null
  const { mode } = detail
  const open = mode.status === "OPEN"

  return (
    <article>
      <header>
        <div>
          <h2>{detail.label}</h2>
          <p>
            <span className={`badge badge-${open ? "open" : "resolved"}`}>{open ? "Open" : "Resolved"}</span>{" "}
            {mode.reappeared && open && <span className="badge badge-flag">Reappeared after being fixed</span>}{" "}
            {mode.regressedScenarioIds.length > 0 && open && (
              <span className="badge badge-flag">
                {mode.regressedScenarioIds.length} regressed {mode.regressedScenarioIds.length === 1 ? "scenario" : "scenarios"}
              </span>
            )}
          </p>
        </div>
        <Link href="/dashboard/triage" role="button" className="outline">
          ← Back
        </Link>
      </header>

      {error && (
        <p role="alert">
          <small style={{ color: "var(--pico-del-color)" }}>{error}</small>
        </p>
      )}

      <section aria-labelledby="score-heading">
        <h3 id="score-heading">Priority score</h3>
        <dl>
          <dt>Frequency (automatic)</dt>
          <dd>
            {mode.frequency} of {mode.totalScenarios} scenarios fail
            {detail.reflects && (
              <small>
                {" "}
                in the latest {detail.reflects.version} run
              </small>
            )}
          </dd>
          <dt>Severity</dt>
          <dd>
            {SEVERITY_LABEL[mode.severity as Level]}
            <small>
              {mode.severityOverride !== null
                ? ` (set by staff; the suggestion from the failing scenarios is ${SEVERITY_LABEL[mode.suggestedSeverity as Level] ?? mode.suggestedSeverity})`
                : " (suggested from the failing scenarios)"}
            </small>
          </dd>
          <dt>Effort</dt>
          <dd>{EFFORT_LABEL[mode.effort as Level] ?? mode.effort}</dd>
          <dt>Score</dt>
          <dd>
            <strong>{open ? mode.score.toFixed(1) : "0.0"}</strong>{" "}
            <small>
              = {mode.frequency} × {mode.severity} ÷ {mode.effort} (frequency × severity ÷ effort)
            </small>
          </dd>
        </dl>

        {canEdit && (
          <form action={updateInputsAction} className="fix-actions">
            <input type="hidden" name="failureModeId" value={mode.id} />
            <label>
              Severity
              <select name="severity" defaultValue={mode.severityOverride === null ? "auto" : String(mode.severityOverride)}>
                <option value="auto">Use the suggestion ({SEVERITY_LABEL[mode.suggestedSeverity as Level] ?? mode.suggestedSeverity})</option>
                <option value="1">Low</option>
                <option value="2">Medium</option>
                <option value="3">High</option>
              </select>
            </label>
            <label>
              Effort
              <select name="effort" defaultValue={String(mode.effort)}>
                <option value="1">S (small)</option>
                <option value="2">M (medium)</option>
                <option value="3">L (large)</option>
              </select>
            </label>
            <button type="submit">Save inputs</button>
          </form>
        )}
      </section>

      <section aria-labelledby="scenarios-heading">
        <h3 id="scenarios-heading">Scenarios in this failure mode</h3>
        <figure>
          <table className="metrics-table">
            <caption className="visually-hidden">Golden scenarios of this theme and their result in the current state</caption>
            <thead>
              <tr>
                <th scope="col">Scenario</th>
                <th scope="col">Set</th>
                <th scope="col">Result</th>
                <th scope="col">Expected</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {detail.scenarios.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.id}</th>
                  <td>{s.split.toLowerCase()}</td>
                  <td>
                    {s.passing === null ? "Not evaluated" : s.passing ? "Passing" : "Failing"}
                    {s.regressed && <span className="badge badge-flag">Regressed</span>}
                  </td>
                  <td>
                    {s.expectedSeverity.toLowerCase()}, {s.expectedTherapy}
                  </td>
                  <td className="wrap-cell">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
        <small>A regressed scenario passed in the previous version and fails now.</small>
      </section>

      <section aria-labelledby="fixes-heading">
        <h3 id="fixes-heading">Fixes ({detail.fixes.length})</h3>
        {detail.fixes.some((f) => f.isSample) && (
          <aside className="sample-notice" role="note" aria-label="Sample data notice">
            <strong>Includes sample fixes.</strong> Fixes marked Sample, with their owners and dates, are illustrative.
          </aside>
        )}
        {detail.fixes.length === 0 ? (
          <p>
            <em>No fix has been proposed for this failure mode yet.</em>
          </p>
        ) : (
          detail.fixes.map((fix) => (
            <FixCard key={fix.id} fix={fix} modeId={mode.id} owners={owners} versions={versions} />
          ))
        )}

        {canEdit && (
          <form action={createFixAction}>
            <h4>Add a fix</h4>
            <input type="hidden" name="failureModeId" value={mode.id} />
            <label>
              Title
              <input type="text" name="title" required maxLength={120} placeholder="What will change?" />
            </label>
            <label>
              Description (optional)
              <textarea name="description" maxLength={1000} rows={3} />
            </label>
            <label>
              Owner
              <select name="ownerId" defaultValue="">
                <option value="">No owner</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.email}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Add fix</button>
          </form>
        )}
      </section>
    </article>
  )
}
