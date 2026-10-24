import Link from "next/link"
import { auth, signOut } from "@/lib/auth"

export default async function NavBar() {
  const session = await auth()
  const role = session?.user?.role

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
