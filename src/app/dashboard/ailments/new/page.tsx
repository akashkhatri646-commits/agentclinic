import { auth } from "@/lib/auth"
import { getAgentByUserId } from "@/lib/agents"
import { redirect } from "next/navigation"
import AilmentForm from "@/components/AilmentForm"

export const metadata = { title: "Log Ailment — AgentClinic" }

export default async function NewAilmentPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  if (session.user.role === "STAFF") redirect("/dashboard/ailments")

  const agent = await getAgentByUserId(session.user.id)
  if (!agent) redirect("/dashboard/ailments")

  return (
    <article>
      <header>
        <h2>Log a New Ailment</h2>
        <p>
          Describe what is troubling you. Our clinical staff will review your
          submission with the gravity it deserves.
        </p>
      </header>
      <AilmentForm agentId={agent.id} />
    </article>
  )
}
