import Link from "next/link"
import { auth } from "@/lib/auth"
import { isStaff } from "@/lib/roles"

export default async function Sidebar() {
  const session = await auth()
  const role = session?.user?.role ?? ""
  return (
    <aside className="clinic-sidebar">
      <nav>
        <ul>
          <li>
            <Link href="/dashboard">Dashboard</Link>
          </li>
          {/* AGENT: personal profile + own ailments */}
          {role === "AGENT" && (
            <>
              <li>
                <Link href="/dashboard/profile">My Profile</Link>
              </li>
              <li>
                <Link href="/dashboard/ailments">My Ailments</Link>
              </li>
            </>
          )}
          {/* ADMIN: personal profile + all ailments view */}
          {role === "ADMIN" && (
            <li>
              <Link href="/dashboard/profile">My Profile</Link>
            </li>
          )}
          {/* STAFF + ADMIN: all ailments */}
          {isStaff(role) && (
            <li>
              <Link href="/dashboard/ailments">All Ailments</Link>
            </li>
          )}
        </ul>
      </nav>
    </aside>
  )
}
