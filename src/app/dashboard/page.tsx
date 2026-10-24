import { auth } from "@/lib/auth"
import { getDashboardStats } from "@/lib/dashboard"
import { isStaff } from "@/lib/roles"
import { redirect } from "next/navigation"
import Link from "next/link"

export const metadata = { title: "Dashboard — AgentClinic" }

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Agents have no dashboard — send them straight to their ailments
  if (!isStaff(session.user.role)) redirect("/dashboard/ailments")

  const { activeCaseload, upcomingAppointments, severityCounts } =
    await getDashboardStats()

  const total = severityCounts.LOW + severityCounts.MEDIUM + severityCounts.HIGH || 1

  return (
    <>
      <article>
        <header>
          <h2>Dashboard</h2>
          <p>
            Signed in as <strong>{session.user.email}</strong> ·{" "}
            <span>{session.user.role}</span>
          </p>
        </header>

        {/* Stat tiles */}
        <div className="grid">
          <div className="stat-tile">
            <p className="stat-label">Active Caseload</p>
            <p className="stat-value">{activeCaseload}</p>
            <p>
              <small>Open + In treatment</small>
            </p>
          </div>

          <div className="stat-tile">
            <p className="stat-label">Upcoming Appointments</p>
            <p className="stat-value">{upcomingAppointments.length}</p>
            <p>
              <small>Next 5</small>
            </p>
          </div>
        </div>
      </article>

      {/* Severity breakdown */}
      <article>
        <header>
          <h3>Severity Breakdown</h3>
          <small>Open ailments only</small>
        </header>
        <dl>
          <dt>
            <span className="badge badge-high">HIGH</span>
          </dt>
          <dd>
            <progress
              value={severityCounts.HIGH}
              max={total}
              aria-label={`High: ${severityCounts.HIGH}`}
              className="severity-bar severity-bar-high"
            />
            <small> {severityCounts.HIGH}</small>
          </dd>
          <dt>
            <span className="badge badge-medium">MEDIUM</span>
          </dt>
          <dd>
            <progress
              value={severityCounts.MEDIUM}
              max={total}
              aria-label={`Medium: ${severityCounts.MEDIUM}`}
              className="severity-bar severity-bar-medium"
            />
            <small> {severityCounts.MEDIUM}</small>
          </dd>
          <dt>
            <span className="badge badge-low">LOW</span>
          </dt>
          <dd>
            <progress
              value={severityCounts.LOW}
              max={total}
              aria-label={`Low: ${severityCounts.LOW}`}
              className="severity-bar severity-bar-low"
            />
            <small> {severityCounts.LOW}</small>
          </dd>
        </dl>
      </article>

      {/* Upcoming appointments table */}
      <article>
        <header>
          <h3>Upcoming Appointments</h3>
          <Link href="/dashboard/appointments" role="button" className="outline">
            View all
          </Link>
        </header>
        {upcomingAppointments.length === 0 ? (
          <p>
            <em>No upcoming appointments.</em>
          </p>
        ) : (
          <figure>
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Therapy</th>
                  <th>When</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingAppointments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/dashboard/ailments/${a.ailmentId}`}>
                        {a.agent.name}
                      </Link>
                    </td>
                    <td>{a.therapy.name}</td>
                    <td>
                      {a.scheduledAt.toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td>
                      <span className={`badge badge-appt-${a.status.toLowerCase()}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        )}
      </article>
    </>
  )
}
