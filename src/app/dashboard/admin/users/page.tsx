import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { updateUserRoleAction } from "../actions"
import Link from "next/link"

export const metadata = { title: "User Management — AgentClinic" }

const ROLES = ["AGENT", "STAFF", "ADMIN"]

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!isAdmin(session.user.role)) redirect("/dashboard")

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } })
  const error = searchParams?.error

  return (
    <article>
      <header>
        <div>
          <h2>User Management</h2>
          <p>Reassign roles. You cannot change your own role.</p>
        </div>
        <Link href="/dashboard/therapies" role="button" className="outline">
          Therapy catalogue
        </Link>
      </header>

      {error && (
        <p>
          <small style={{ color: "var(--pico-del-color)" }}>{decodeURIComponent(error)}</small>
        </p>
      )}

      <figure>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Change role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  <span className={`badge badge-role-${u.role.toLowerCase()}`}>{u.role}</span>
                </td>
                <td>
                  {u.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
                </td>
                <td>
                  {u.id === session.user.id ? (
                    <small>(you)</small>
                  ) : (
                    <RoleForm userId={u.id} currentRole={u.role} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </article>
  )
}

function RoleForm({ userId, currentRole }: { userId: string; currentRole: string }) {
  async function handleChange(formData: FormData) {
    "use server"
    const newRole = formData.get("role") as string
    const result = await updateUserRoleAction(userId, newRole)
    if (result?.error) {
      redirect(`/dashboard/admin/users?error=${encodeURIComponent(result.error)}`)
    }
  }

  return (
    <form action={handleChange} style={{ display: "flex", gap: "0.5rem", margin: 0 }}>
      <select name="role" aria-label="Role" defaultValue={currentRole} style={{ margin: 0 }}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button type="submit" style={{ margin: 0 }}>
        Save
      </button>
    </form>
  )
}
