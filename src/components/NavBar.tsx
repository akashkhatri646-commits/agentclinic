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
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold text-gray-900">
          AgentClinic
        </Link>
        {session && (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            {role === "ADMIN" && (
              <Link href="/dashboard/admin" className="text-gray-600 hover:text-gray-900">
                Admin
              </Link>
            )}
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">{session.user?.email}</span>
            <form action={handleSignOut}>
              <button
                type="submit"
                className="rounded bg-gray-100 px-3 py-1 text-gray-700 hover:bg-gray-200"
              >
                Sign out
              </button>
            </form>
          </nav>
        )}
      </div>
    </header>
  )
}
