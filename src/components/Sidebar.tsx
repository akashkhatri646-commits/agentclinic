import Link from "next/link"
import { auth } from "@/lib/auth"
import { isStaff, isAdmin } from "@/lib/roles"

export default async function Sidebar() {
  const session = await auth()
  const role = session?.user?.role ?? ""
  const staff = isStaff(role)
  const admin = isAdmin(role)

  return (
    <aside className="clinic-sidebar">
      <nav>
        <ul>
          {/* STAFF + ADMIN: dashboard */}
          {staff && (
            <li>
              <Link href="/dashboard">Dashboard</Link>
            </li>
          )}

          {/* AGENT: personal profile + own ailments + appointments */}
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

          {/* ADMIN: personal profile */}
          {admin && (
            <li>
              <Link href="/dashboard/profile">My Profile</Link>
            </li>
          )}

          {/* STAFF + ADMIN: all ailments */}
          {staff && (
            <li>
              <Link href="/dashboard/ailments">All Ailments</Link>
            </li>
          )}

          {/* STAFF + ADMIN: therapies + appointments */}
          {staff && (
            <>
              <li>
                <Link href="/dashboard/therapies">Therapies</Link>
              </li>
              <li>
                <Link href="/dashboard/appointments">Appointments</Link>
              </li>
            </>
          )}

          {/* STAFF + ADMIN: evals */}
          {staff && (
            <li>
              <Link href="/dashboard/evals">Evals</Link>
            </li>
          )}

          {/* Everyone: notifications */}
          <li>
            <Link href="/dashboard/notifications">Notifications</Link>
          </li>

          {/* ADMIN only: user management */}
          {admin && (
            <li>
              <Link href="/dashboard/admin/users">Users</Link>
            </li>
          )}
        </ul>
      </nav>
    </aside>
  )
}
