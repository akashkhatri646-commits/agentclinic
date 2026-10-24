import { auth } from "@/lib/auth"
import { getAilmentById, assignTherapy, type AilmentSeverity, type AilmentStatus } from "@/lib/ailments"
import { getAllTherapies } from "@/lib/therapies"
import { getActiveAppointmentByAilmentId, cancelAppointment } from "@/lib/appointments"
import { isStaff } from "@/lib/roles"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"

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

export default async function AilmentDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const ailment = await getAilmentById(params.id)
  if (!ailment) notFound()

  const role = session.user.role
  const staff = isStaff(role)

  // Agents can only view their own ailments
  if (!staff) {
    const { getAgentByUserId } = await import("@/lib/agents")
    const agent = await getAgentByUserId(session.user.id)
    if (!agent || agent.id !== ailment.agentId) redirect("/dashboard/ailments")
  }

  const [therapies, activeAppointment] = await Promise.all([
    staff ? getAllTherapies() : Promise.resolve([]),
    getActiveAppointmentByAilmentId(ailment.id),
  ])

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
      </dl>

      {/* Staff: assign therapy */}
      {staff && ailment.status !== "RESOLVED" && (
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
      {!staff && (
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
            <ConfirmAppointmentForm appointmentId={activeAppointment.id} />
            <CancelAppointmentForm appointmentId={activeAppointment.id} ailmentId={ailment.id} />
          </div>
        </section>
      )}
    </article>
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
  async function handleAssign(formData: FormData) {
    "use server"
    const therapyId = formData.get("therapyId") as string
    if (!therapyId) return
    await assignTherapy(ailmentId, therapyId)
    redirect(`/dashboard/ailments/${ailmentId}`)
  }

  return (
    <form action={handleAssign}>
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
  async function handleCancel() {
    "use server"
    await cancelAppointment(appointmentId)
    redirect(`/dashboard/ailments/${ailmentId}`)
  }
  return (
    <form action={handleCancel} style={{ margin: 0 }}>
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

function ConfirmAppointmentForm({ appointmentId }: { appointmentId: string }) {
  async function handleConfirm() {
    "use server"
    const { updateAppointmentStatus } = await import("@/lib/appointments")
    await updateAppointmentStatus(appointmentId, "CONFIRMED")
    redirect(".")
  }
  return (
    <form action={handleConfirm} style={{ margin: 0 }}>
      <button type="submit">Confirm appointment</button>
    </form>
  )
}
