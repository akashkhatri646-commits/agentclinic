import { auth } from "@/lib/auth"
import { canManageSpecialist, canViewSpecialists } from "@/lib/guards"
import { configTextOf } from "@/lib/evals/spec-view"
import { loadSpecialist } from "@/lib/evals/specialist-store"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import SpecialistForm from "@/components/SpecialistForm"
import { updateSpecialistAction } from "../../actions"

export const metadata = { title: "Edit Specialist — AgentClinic" }

export default async function EditSpecialistPage({ params }: { params: { slug: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewSpecialists(session.user.role)) redirect("/dashboard")

  const loaded = await loadSpecialist(prisma, params.slug)
  if (!loaded) notFound()
  // Only the owner or an admin may change it; anyone else is sent back to look.
  if (!canManageSpecialist(session.user.role, session.user.id, loaded.ownerId)) redirect(`/dashboard/specialists/${params.slug}`)

  const runCount = await prisma.evalRun.count({ where: { specialistId: loaded.spec.slug } })

  return (
    <article>
      <header>
        <div>
          <h2>Edit {loaded.spec.name}</h2>
          <p>Replace the definition. The slug cannot change.</p>
        </div>
        <Link href={`/dashboard/specialists/${params.slug}`} role="button" className="outline">
          ← Back
        </Link>
      </header>

      {runCount > 0 && (
        <p role="note">
          <strong>This specialist has {runCount} {runCount === 1 ? "run" : "runs"}.</strong> You can add scenarios, themes and
          fields, and reword anything, but you cannot remove or rename a scenario, output field, theme or check, move a
          scenario between dev and hold-out, or change its theme. Existing results depend on them.
        </p>
      )}

      <SpecialistForm
        action={updateSpecialistAction.bind(null, params.slug)}
        initialText={configTextOf(loaded.spec)}
        submitLabel="Save changes"
        cancelHref={`/dashboard/specialists/${params.slug}`}
        textLabel="Specialist config (JSON)"
        help="Saving replaces the definition. Nothing changes if any part is invalid."
      />
    </article>
  )
}
