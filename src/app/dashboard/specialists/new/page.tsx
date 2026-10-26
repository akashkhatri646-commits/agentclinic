import { auth } from "@/lib/auth"
import { canCreateSpecialist } from "@/lib/guards"
import { TEMPLATES, templateText } from "@/lib/evals/templates"
import { redirect } from "next/navigation"
import Link from "next/link"
import SpecialistForm from "@/components/SpecialistForm"
import { createSpecialistAction } from "../actions"

export const metadata = { title: "New Specialist — AgentClinic" }

export default async function NewSpecialistPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canCreateSpecialist(session.user.role)) redirect("/dashboard")

  const templates = TEMPLATES.map((t) => ({ id: t.id, label: t.label, summary: t.summary, text: templateText(t) }))
  const start = templates.find((t) => t.id === "classification") ?? templates[0]

  return (
    <article>
      <header>
        <div>
          <h2>New specialist</h2>
          <p>
            Describe your specialist in one JSON document: what it returns, how each answer is checked, and its golden
            scenarios. You will own it. Nothing is saved until the whole document is valid.
          </p>
        </div>
        <Link href="/dashboard/specialists" role="button" className="outline">
          ← Back
        </Link>
      </header>

      <details>
        <summary>The templates</summary>
        <ul>
          {templates.map((t) => (
            <li key={t.id}>
              <strong>{t.label}</strong>: {t.summary}
            </li>
          ))}
        </ul>
      </details>

      <SpecialistForm
        action={createSpecialistAction}
        initialText={start.text}
        submitLabel="Create specialist"
        cancelHref="/dashboard/specialists"
        textLabel="Specialist config (JSON)"
        help="Format agentclinic.specialist/1. See the playbook (docs/playbook.md) for every field."
        templates={templates}
      />
    </article>
  )
}
