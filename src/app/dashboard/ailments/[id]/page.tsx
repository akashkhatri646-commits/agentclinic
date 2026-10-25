import { auth } from "@/lib/auth"
import { getAilmentById, type AilmentSeverity, type AilmentStatus } from "@/lib/ailments"
import { getAllTherapies } from "@/lib/therapies"
import { getAppointmentsByAilmentId, type AppointmentFull } from "@/lib/appointments"
import { isStaff } from "@/lib/roles"
import { canViewAilment } from "@/lib/guards"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import {
  assignTherapyAction,
  cancelAppointmentAction,
  confirmAppointmentAction,
  dischargeAilmentAction,
  reopenAilmentAction,
} from "../actions"

export const metadata = { title: "Ailment Detail — AgentClinic" }

function SeverityBadge({ severity }: { severity: AilmentSeverity }) {
  return <span className={`badge badge-${severity.toLowerCase()}`}>{severity}</span>
}

function StatusBadge({ status }: { status: AilmentStatus }) {
  const slug = status.toLowerCase().replace(/_/g, "-")
  return <span className={`badge badge-${slug}`}>{status.replace(/_/g, " ")}</span>
}

function AppointmentStatusBadge({ status }: { status: string }) {
  const slug = `appt-${status.toLowerCase()}`
  return <span className={`badge badge-${slug}`}>{status}</span>
}

export default async function AilmentDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const ailment = await getAilmentById(params.id)
  if (!ailment) notFound()

  const role = session.user.role
  const staff = isStaff(role)

  // Agents can only view their own ailments
  if (!canViewAilment(role, session.user.id, ailment.agent.userId)) {
    redirect("/dashboard/ailments")
  }

  const [therapies, appointments] = await Promise.all([
    staff ? getAllTherapies() : Promise.resolve([]),
    getAppointmentsByAilmentId(ailment.id),
  ])
  const activeAppointment =
    appointments.find((a) => a.status === "PENDING" || a.status === "CONFIRMED") ?? null
  const resolved = ailment.status === "RESOLVED"
  const error = searchParams.error

  return (
    <article>
      <header>
        <div>
          <h2>Ailment Detail</h2>
          <p>{ailment.agent.name}</p>
        </div>
        <Link href="/dashboard/ailments" role="button" className="outline">
          ← Back
        </Link>
      </header>

      {error && (
        <p role="alert">
          <small style={{ color: "var(--pico-del-color)" }}>{error}</small>
        </p>
      )}

      <dl>
        <dt>Description</dt>
        <dd>{ailment.description}</dd>
        <dt>Severity</dt>
        <dd>
          <SeverityBadge severity={ailment.severity} />
        </dd>
        <dt>Status</dt>
        <dd>
          <StatusBadge status={ailment.status} />
        </dd>
        <dt>Logged</dt>
        <dd>{ailment.createdAt.toLocaleDateString("en-GB", { dateStyle: "long" })}</dd>
        <dt>Assigned Therapy</dt>
        <dd>{ailment.therapy ? ailment.therapy.name : <em>None assigned</em>}</dd>
        {ailment.dischargedAt && (
          <>
            <dt>Discharged</dt>
            <dd>{ailment.dischargedAt.toLocaleDateString("en-GB", { dateStyle: "long" })}</dd>
            <dt>Discharge Note</dt>
            <dd>{ailment.dischargeNote}</dd>
          </>
        )}
      </dl>

      {/* Staff: assign therapy */}
      {staff && !resolved && (
        <section>
          <h3>Assign Therapy</h3>
          <AssignTherapyForm
            ailmentId={ailment.id}
            therapies={therapies}
            currentTherapyId={ailment.therapyId ?? undefined}
          />
        </section>
      )}

      {/* Agent: appointment section */}
      {!staff && !resolved && (
        <section>
          <h3>Appointment</h3>
          {activeAppointment ? (
            <div>
              <dl>
                <dt>Scheduled</dt>
                <dd>
                  {activeAppointment.scheduledAt.toLocaleString("en-GB", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                </dd>
                <dt>Staff</dt>
                <dd>{activeAppointment.staff.email}</dd>
                <dt>Status</dt>
                <dd>
                  <AppointmentStatusBadge status={activeAppointment.status} />
                </dd>
              </dl>
              <CancelAppointmentForm appointmentId={activeAppointment.id} ailmentId={ailment.id} />
            </div>
          ) : ailment.therapy ? (
            <div>
              <p>
                Therapy assigned: <strong>{ailment.therapy.name}</strong>. Ready to book
                your session?
              </p>
              <Link href={`/dashboard/ailments/${ailment.id}/book`} role="button">
                Book appointment
              </Link>
            </div>
          ) : (
            <p>
              <em>
                No therapy has been assigned yet. A staff member will review your ailment
                shortly.
              </em>
            </p>
          )}
        </section>
      )}

      {/* Staff: discharge / reopen */}
      {staff && !resolved && (
        <section>
          <h3>Discharge</h3>
          <form action={dischargeAilmentAction}>
            <input type="hidden" name="ailmentId" value={ailment.id} />
            <label>
              Discharge note
              <textarea
                name="note"
                required
                maxLength={2000}
                rows={3}
                placeholder="Summarise the treatment and outcome…"
              />
            </label>
            <button type="submit">Discharge ailment</button>
          </form>
          <small>Discharging cancels any upcoming appointments for this ailment.</small>
        </section>
      )}

      {staff && resolved && (
        <section>
          <h3>Reopen</h3>
          <form action={reopenAilmentAction}>
            <input type="hidden" name="ailmentId" value={ailment.id} />
            <button type="submit" className="outline">
              Reopen ailment
            </button>
          </form>
        </section>
      )}

      {/* Staff: appointment management */}
      {staff && activeAppointment && (
        <section>
          <h3>Active Appointment</h3>
          <dl>
            <dt>Scheduled</dt>
            <dd>
              {activeAppointment.scheduledAt.toLocaleString("en-GB", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </dd>
            <dt>Agent</dt>
            <dd>{activeAppointment.agent.name}</dd>
            <dt>Status</dt>
            <dd>
              <AppointmentStatusBadge status={activeAppointment.status} />
            </dd>
          </dl>
          <div style={{ display: "flex", gap: "1rem" }}>
            {activeAppointment.status === "PENDING" && (
              <ConfirmAppointmentForm appointmentId={activeAppointment.id} ailmentId={ailment.id} />
            )}
            <CancelAppointmentForm appointmentId={activeAppointment.id} ailmentId={ailment.id} />
          </div>
        </section>
      )}

      <TreatmentHistory ailment={ailment} appointments={appointments} />
    </article>
  )
}

type HistoryEntry = { at: Date; label: React.ReactNode }

function TreatmentHistory({
  ailment,
  appointments,
}: {
  ailment: NonNullable<Awaited<ReturnType<typeof getAilmentById>>>
  appointments: AppointmentFull[]
}) {
  const fmt = (d: Date) => d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
  const entries: HistoryEntry[] = [
    {
      at: ailment.createdAt,
      label: <>Ailment logged ({ailment.severity.toLowerCase()} severity)</>,
    },
    ...appointments.map((a) => ({
      at: a.scheduledAt,
      label: (
        <>
          {a.therapy.name} session with {a.staff.email}{" "}
          <AppointmentStatusBadge status={a.status} />
        </>
      ),
    })),
  ]
  if (ailment.dischargedAt) {
    entries.push({
      at: ailment.dischargedAt,
      label: (
        <>
          <strong>Discharged.</strong> {ailment.dischargeNote}
        </>
      ),
    })
  }
  entries.sort((x, y) => x.at.getTime() - y.at.getTime())

  return (
    <section aria-labelledby="history-heading">
      <h3 id="history-heading">Treatment History</h3>
      <ol>
        {entries.map((e, i) => (
          <li key={i}>
            <small>{fmt(e.at)}</small>
            <br />
            {e.label}
          </li>
        ))}
      </ol>
    </section>
  )
}

function AssignTherapyForm({
  ailmentId,
  therapies,
  currentTherapyId,
}: {
  ailmentId: string
  therapies: { id: string; name: string; durationMinutes: number }[]
  currentTherapyId?: string
}) {
  return (
    <form action={assignTherapyAction}>
      <input type="hidden" name="ailmentId" value={ailmentId} />
      <label>
        Therapy
        <select name="therapyId" required defaultValue={currentTherapyId ?? ""}>
          <option value="">Select a therapy…</option>
          {therapies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.durationMinutes} min)
            </option>
          ))}
        </select>
      </label>
      <button type="submit">Assign therapy</button>
    </form>
  )
}

function CancelAppointmentForm({
  appointmentId,
  ailmentId,
}: {
  appointmentId: string
  ailmentId: string
}) {
  return (
    <form action={cancelAppointmentAction} style={{ margin: 0 }}>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="returnTo" value={`/dashboard/ailments/${ailmentId}`} />
      <button
        type="submit"
        className="outline"
        style={{ color: "var(--pico-del-color)", borderColor: "var(--pico-del-color)" }}
      >
        Cancel appointment
      </button>
    </form>
  )
}

function ConfirmAppointmentForm({
  appointmentId,
  ailmentId,
}: {
  appointmentId: string
  ailmentId: string
}) {
  return (
    <form action={confirmAppointmentAction} style={{ margin: 0 }}>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="returnTo" value={`/dashboard/ailments/${ailmentId}`} />
      <button type="submit">Confirm appointment</button>
    </form>
  )
}
