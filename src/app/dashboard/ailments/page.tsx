import { auth } from "@/lib/auth"
import { getAgentByUserId } from "@/lib/agents"
import {
  getAilmentsByAgentId,
  getAllAilments,
  type AilmentSeverity,
  type AilmentStatus,
  type AilmentWithAgent,
} from "@/lib/ailments"
import { isStaff } from "@/lib/roles"
import { redirect } from "next/navigation"
import Link from "next/link"

type SeverityBadgeProps = { severity: AilmentSeverity }
type StatusBadgeProps = { status: AilmentStatus }

function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={`badge badge-${severity.toLowerCase()}`}>{severity}</span>
  )
}

function StatusBadge({ status }: StatusBadgeProps) {
  const slug = status.toLowerCase().replace(/_/g, "-")
  const label = status.replace(/_/g, " ")
  return <span className={`badge badge-${slug}`}>{label}</span>
}

export const metadata = { title: "Ailments — AgentClinic" }

export default async function AilmentsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const role = session.user.role
  const staff = isStaff(role)

  let ailments: AilmentWithAgent[]

  if (staff) {
    ailments = await getAllAilments()
  } else {
    const agent = await getAgentByUserId(session.user.id)
    if (!agent) {
      return (
        <article>
          <header>
            <h2>My Ailments</h2>
          </header>
          <p>
            You don&apos;t have an agent profile yet. Contact your administrator.
          </p>
        </article>
      )
    }
    ailments = await getAilmentsByAgentId(agent.id)
  }

  return (
    <article>
      <header>
        <div>
          <h2>{staff ? "All Ailments" : "My Ailments"}</h2>
        </div>
        {role !== "STAFF" && (
          <Link href="/dashboard/ailments/new" role="button">
            Log a new ailment
          </Link>
        )}
      </header>

      {ailments.length === 0 ? (
        <p>
          {staff
            ? "No ailments have been submitted yet. An encouraging sign — or the agents are suffering in silence."
            : "No ailments on record. Congratulations — you’re fine. For now."}
        </p>
      ) : (
        <figure>
          <table>
            <thead>
              <tr>
                {staff && <th>Agent</th>}
                <th>Description</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Logged</th>
              </tr>
            </thead>
            <tbody>
              {ailments.map((a) => (
                <tr key={a.id}>
                  {staff && <td>{a.agent.name}</td>}
                  <td>
                    {a.description.length > 80
                      ? a.description.slice(0, 80) + "…"
                      : a.description}
                  </td>
                  <td>
                    <SeverityBadge severity={a.severity} />
                  </td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td>
                    {a.createdAt.toLocaleDateString("en-GB", {
                      dateStyle: "medium",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}
    </article>
  )
}
