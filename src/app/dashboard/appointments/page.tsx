import { auth } from "@/lib/auth"
import {
  getAppointmentsByStaffId,
  getAllAppointments,
  type AppointmentFull,
} from "@/lib/appointments"
import { confirmAppointmentAction, cancelAppointmentAction } from "../ailments/actions"
import { isStaff } from "@/lib/roles"
import { redirect } from "next/navigation"
import Link from "next/link"
import EmptyState from "@/components/EmptyState"

export const metadata = { title: "Appointments — AgentClinic" }

function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // Mon start
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
const HOURS = Array.from({ length: 8 }, (_, i) => i + 9) // 9–16

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: { week?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!isStaff(session.user.role)) redirect("/dashboard")

  const isAdmin = session.user.role === "ADMIN"
  const appointments = isAdmin
    ? await getAllAppointments()
    : await getAppointmentsByStaffId(session.user.id)

  // Week navigation
  const weekParam = searchParams.week ? new Date(searchParams.week) : new Date()
  const weekStart = startOfWeek(
    isNaN(weekParam.getTime()) ? new Date() : weekParam
  )
  const weekEnd = addDays(weekStart, 6)

  const prevWeek = addDays(weekStart, -7).toISOString().split("T")[0]
  const nextWeek = addDays(weekStart, 7).toISOString().split("T")[0]

  const weekAppts = appointments.filter((a) => {
    const d = a.scheduledAt
    return d >= weekStart && d <= weekEnd && a.status !== "CANCELLED"
  })

  // Group by day index (0=Mon) and hour
  type SlotMap = Map<string, AppointmentFull>
  const slotMap: SlotMap = new Map()
  for (const a of weekAppts) {
    const dow = a.scheduledAt.getDay() === 0 ? 6 : a.scheduledAt.getDay() - 1
    const h = a.scheduledAt.getHours()
    slotMap.set(`${dow}-${h}`, a)
  }

  return (
    <article>
      <header>
        <div>
          <h2>Appointments</h2>
          {isAdmin && <p>All staff appointments</p>}
        </div>
      </header>

      {/* Week nav */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <Link href={`?week=${prevWeek}`} role="button" className="outline">
          ← Prev week
        </Link>
        <span>
          {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          {" – "}
          {weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        <Link href={`?week=${nextWeek}`} role="button" className="outline">
          Next week →
        </Link>
      </div>

      {weekAppts.length === 0 ? (
        <EmptyState message="No appointments scheduled for this week." />
      ) : (
        <figure style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                {DAY_LABELS.map((d, i) => (
                  <th key={d}>
                    {d}{" "}
                    <small>
                      {addDays(weekStart, i).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((h) => (
                <tr key={h}>
                  <td>
                    <small>{h}:00</small>
                  </td>
                  {Array.from({ length: 5 }, (_, dow) => {
                    const appt = slotMap.get(`${dow}-${h}`)
                    return (
                      <td key={dow} style={{ minWidth: "8rem" }}>
                        {appt ? (
                          <CalendarSlot appt={appt} isAdmin={isAdmin} />
                        ) : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}

      {/* Admin: full list */}
      {isAdmin && (
        <section>
          <h3>All Appointments</h3>
          <AppointmentsList appointments={appointments} />
        </section>
      )}
    </article>
  )
}

function CalendarSlot({
  appt,
  isAdmin,
}: {
  appt: AppointmentFull
  isAdmin: boolean
}) {
  return (
    <div
      style={{
        background: "var(--pico-muted-background-color)",
        padding: "0.25rem 0.5rem",
        borderRadius: "var(--pico-border-radius)",
        fontSize: "0.8rem",
      }}
    >
      <Link href={`/dashboard/ailments/${appt.ailmentId}`}>
        <strong>{appt.agent.name}</strong>
      </Link>
      <br />
      <small>{appt.therapy.name}</small>
      <br />
      <span className={`badge badge-appt-${appt.status.toLowerCase()}`}>{appt.status}</span>
      <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem" }}>
        {appt.status === "PENDING" && <ConfirmForm id={appt.id} />}
        <CancelForm id={appt.id} />
      </div>
    </div>
  )
}

function AppointmentsList({ appointments }: { appointments: AppointmentFull[] }) {
  if (appointments.length === 0) {
    return <EmptyState message="No appointments in the system yet." />
  }
  return (
    <figure>
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Therapy</th>
            <th>Staff</th>
            <th>Scheduled</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id}>
              <td>
                <Link href={`/dashboard/ailments/${a.ailmentId}`}>{a.agent.name}</Link>
              </td>
              <td>{a.therapy.name}</td>
              <td>{a.staff.email}</td>
              <td>
                {a.scheduledAt.toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </td>
              <td>
                <span className={`badge badge-appt-${a.status.toLowerCase()}`}>{a.status}</span>
              </td>
              <td>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {a.status === "PENDING" && <ConfirmForm id={a.id} />}
                  {a.status !== "CANCELLED" && <CancelForm id={a.id} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function ConfirmForm({ id }: { id: string }) {
  return (
    <form action={confirmAppointmentAction} style={{ margin: 0 }}>
      <input type="hidden" name="appointmentId" value={id} />
      <input type="hidden" name="returnTo" value="/dashboard/appointments" />
      <button type="submit" style={{ padding: "0.125rem 0.5rem", fontSize: "0.75rem" }}>
        Confirm
      </button>
    </form>
  )
}

function CancelForm({ id }: { id: string }) {
  return (
    <form action={cancelAppointmentAction} style={{ margin: 0 }}>
      <input type="hidden" name="appointmentId" value={id} />
      <input type="hidden" name="returnTo" value="/dashboard/appointments" />
      <button
        type="submit"
        className="outline"
        style={{
          padding: "0.125rem 0.5rem",
          fontSize: "0.75rem",
          color: "var(--pico-del-color)",
          borderColor: "var(--pico-del-color)",
        }}
      >
        Cancel
      </button>
    </form>
  )
}
