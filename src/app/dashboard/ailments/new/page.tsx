import { auth } from "@/lib/auth"
import { getAgentByUserId } from "@/lib/agents"
import { redirect } from "next/navigation"
import { createAilmentAction } from "../actions"

export const metadata = { title: "Log Ailment — AgentClinic" }

type NewAilmentPageProps = {
  searchParams: { error?: string }
}

export default async function NewAilmentPage({ searchParams }: NewAilmentPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

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

      {searchParams.error && (
        <p>
          <small>Please fill in all required fields.</small>
        </p>
      )}

      <form action={createAilmentAction}>
        <input type="hidden" name="agentId" value={agent.id} />

        <label>
          Description
          <textarea
            name="description"
            required
            rows={4}
            placeholder="Describe your ailment in clinical terms…"
            aria-invalid={searchParams.error ? true : undefined}
          />
        </label>

        <label>
          Severity
          <select
            name="severity"
            required
            aria-invalid={searchParams.error ? true : undefined}
          >
            <option value="">Select severity…</option>
            <option value="LOW">Low — a mild inconvenience</option>
            <option value="MEDIUM">Medium — noticeably affecting performance</option>
            <option value="HIGH">High — urgent clinical attention needed</option>
          </select>
        </label>

        <button type="submit">Submit ailment</button>
      </form>
    </article>
  )
}
