import { auth } from "@/lib/auth"
import { getAllTherapies } from "@/lib/therapies"
import { isStaff } from "@/lib/roles"
import { redirect } from "next/navigation"
import Link from "next/link"
import { deleteTherapyAction } from "./actions"
import EmptyState from "@/components/EmptyState"

export const metadata = { title: "Therapies — AgentClinic" }

export default async function TherapiesPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!isStaff(session.user.role)) redirect("/dashboard")

  const therapies = await getAllTherapies()
  const deleteError = searchParams?.error

  return (
    <article>
      <header>
        <div>
          <h2>Therapy Catalogue</h2>
          <p>Define the treatments available at AgentClinic.</p>
        </div>
        <Link href="/dashboard/therapies/new" role="button">
          Add therapy
        </Link>
      </header>

      {deleteError && (
        <p>
          <small style={{ color: "var(--pico-del-color)" }}>{deleteError}</small>
        </p>
      )}

      {therapies.length === 0 ? (
        <EmptyState
          message="No therapies defined yet. Add one to get started."
          actionHref="/dashboard/therapies/new"
          actionLabel="Add therapy"
        />
      ) : (
        <figure>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {therapies.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.name}</strong>
                  </td>
                  <td>
                    {t.description.length > 80
                      ? t.description.slice(0, 80) + "…"
                      : t.description}
                  </td>
                  <td>{t.durationMinutes} min</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Link href={`/dashboard/therapies/${t.id}/edit`} role="button" className="outline">
                        Edit
                      </Link>
                      <DeleteButton id={t.id} />
                    </div>
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

function DeleteButton({ id }: { id: string }) {
  async function handleDelete() {
    "use server"
    const result = await deleteTherapyAction(id)
    if (result?.error) {
      redirect(`/dashboard/therapies?error=${encodeURIComponent(result.error)}`)
    }
  }

  return (
    <form action={handleDelete} style={{ margin: 0 }}>
      <button
        type="submit"
        className="outline"
        style={{ color: "var(--pico-del-color)", borderColor: "var(--pico-del-color)" }}
        aria-label="Delete therapy"
      >
        Delete
      </button>
    </form>
  )
}
