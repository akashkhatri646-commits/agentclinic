import Link from "next/link"
import { auth, signOut } from "@/lib/auth"
import { getUnreadCount } from "@/lib/notifications"

export default async function NavBar() {
  const session = await auth()
  const role = session?.user?.role
  const unread = session?.user?.id ? await getUnreadCount(session.user.id) : 0

  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <nav>
      <ul>
        <li>
          <Link href="/">
            <h1 className="site-brand">AgentClinic</h1>
          </Link>
        </li>
      </ul>
      {session && (
        <ul>
          <li>
            <Link href="/dashboard">Dashboard</Link>
          </li>
          {role === "ADMIN" && (
            <li>
              <Link href="/dashboard/admin/users">Users</Link>
            </li>
          )}
          <li>
            <Link
              href="/dashboard/notifications"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            >
              Notifications
              {unread > 0 && (
                <span className="nav-badge" aria-hidden="true">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          </li>

          <li>
            <small>{session.user?.email}</small>
          </li>
          <li>
            <form action={handleSignOut}>
              <button type="submit">Sign out</button>
            </form>
          </li>
        </ul>
      )}
    </nav>
  )
}
