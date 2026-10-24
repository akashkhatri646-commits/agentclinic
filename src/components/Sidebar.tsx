import Link from "next/link"
import { auth } from "@/lib/auth"
import { isStaff } from "@/lib/roles"

export default async function Sidebar() {
  const session = await auth()
  const role = session?.user?.role ?? ""
  const staff = isStaff(role)

  return (
    <aside className="clinic-sidebar">
      <nav>
        <ul>
          <li>
            <Link href="/dashboard">Dashboard</Link>
          </li>
          {!staff && (
            <>
              <li>
                <Link href="/dashboard/profile">My Profile</Link>
              </li>
              <li>
                <Link href="/dashboard/ailments">My Ailments</Link>
              </li>
            </>
          )}
          {staff && (
            <li>
              <Link href="/dashboard/ailments">All Ailments</Link>
            </li>
          )}
        </ul>
      </nav>
    </aside>
  )
}
