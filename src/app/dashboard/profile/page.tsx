import { auth } from "@/lib/auth"
import { getAgentByUserId } from "@/lib/agents"
import { redirect } from "next/navigation"

export const metadata = { title: "My Profile — AgentClinic" }

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const agent = await getAgentByUserId(session.user.id)

  if (!agent) {
    return (
      <article>
        <header>
          <h2>No Profile Found</h2>
        </header>
        <p>
          This account does not have an agent profile. Contact your administrator.
        </p>
      </article>
    )
  }

  return (
    <article>
      <header>
        <h2>{agent.name}</h2>
        <p>Agent Profile</p>
      </header>
      <dl>
        <dt>Model</dt>
        <dd>
          <code>{agent.model}</code>
        </dd>
        <dt>Registered</dt>
        <dd>
          {agent.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
        </dd>
        {agent.ownerNotes && (
          <>
            <dt>Clinical Notes</dt>
            <dd>{agent.ownerNotes}</dd>
          </>
        )}
      </dl>
    </article>
  )
}
