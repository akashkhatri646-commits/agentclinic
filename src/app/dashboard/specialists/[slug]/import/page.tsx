import { auth } from "@/lib/auth"
import { canImportOutputs, canViewSpecialists } from "@/lib/guards"
import { isJudgeConfigured } from "@/lib/evals/judge"
import { listInstances } from "@/lib/evals/instances"
import { outputsSkeleton } from "@/lib/evals/outputs"
import { suggestNextVersion } from "@/lib/evals/spec-view"
import { loadSpecialist } from "@/lib/evals/specialist-store"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import SpecialistForm from "@/components/SpecialistForm"
import { importOutputsAction } from "../../actions"

export const metadata = { title: "Import Outputs — AgentClinic" }

export default async function ImportOutputsPage({ params }: { params: { slug: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewSpecialists(session.user.role)) redirect("/dashboard")

  const loaded = await loadSpecialist(prisma, params.slug)
  if (!loaded) notFound()
  if (!canImportOutputs(session.user.role, session.user.id, loaded.ownerId)) redirect(`/dashboard/specialists/${params.slug}`)

  const instances = await listInstances(prisma)
  const next = suggestNextVersion(loaded.versions.map((v) => v.label))

  return (
    <article>
      <header>
        <div>
          <h2>Import outputs for {loaded.spec.name}</h2>
          <p>
            Run your specialist on every scenario, wherever it lives, and paste what it returned. The harness grades the
            answers, stores a run and gives you the verdict. Nothing is executed or fetched.
          </p>
        </div>
        <Link href={`/dashboard/specialists/${params.slug}`} role="button" className="outline">
          ← Back
        </Link>
      </header>

      <details>
        <summary>How this works</summary>
        <ol>
          <li>The text below lists every scenario and every output field with an empty value. Fill them in.</li>
          <li>
            Set <code>version</code> to a new label to register a new version. A new version needs <code>releasedAt</code>: when the
            change shipped. That is where loop time starts, so use the real time.
          </li>
          <li>Reusing an existing label adds another run of that version, for example on another customer instance.</li>
          <li>Every scenario must be present. Nothing may be added.</li>
        </ol>
      </details>

      <SpecialistForm
        action={importOutputsAction.bind(null, params.slug)}
        initialText={outputsSkeleton(loaded.spec, next)}
        submitLabel="Import and grade"
        cancelHref={`/dashboard/specialists/${params.slug}`}
        textLabel="Outputs (JSON)"
        help="Format agentclinic.outputs/1."
        instances={instances.map((i) => ({ slug: i.slug, name: i.name, shape: i.shape }))}
        offerJudge={isJudgeConfigured() && Boolean(loaded.spec.judge)}
      />
    </article>
  )
}
