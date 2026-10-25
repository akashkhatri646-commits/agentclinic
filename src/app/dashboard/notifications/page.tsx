import { auth } from "@/lib/auth"
import { getNotificationsForUser } from "@/lib/notifications"
import { redirect } from "next/navigation"
import Link from "next/link"
import EmptyState from "@/components/EmptyState"
import { markAllReadAction, markNotificationReadAction } from "./actions"

export const metadata = { title: "Notifications — AgentClinic" }

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const notifications = await getNotificationsForUser(session.user.id)
  const unread = notifications.filter((n) => !n.readAt).length

  return (
    <article>
      <header>
        <div>
          <h2>Notifications</h2>
          <p>{unread > 0 ? `${unread} unread` : "You're all caught up."}</p>
        </div>
        {unread > 0 && (
          <form action={markAllReadAction} style={{ margin: 0 }}>
            <button type="submit" className="outline">
              Mark all as read
            </button>
          </form>
        )}
      </header>

      {notifications.length === 0 ? (
        <EmptyState message="No notifications yet. Appointment updates and discharges will appear here." />
      ) : (
        <ul className="notification-list">
          {notifications.map((n) => (
            <li key={n.id} className={n.readAt ? "notification" : "notification notification-unread"}>
              <div>
                <p>
                  {!n.readAt && <span className="badge badge-open">New</span>}{" "}
                  {n.href ? <Link href={n.href}>{n.message}</Link> : n.message}
                </p>
                <small>
                  {n.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </small>
              </div>
              {!n.readAt && (
                <form action={markNotificationReadAction} style={{ margin: 0 }}>
                  <input type="hidden" name="notificationId" value={n.id} />
                  <button type="submit" className="outline notification-mark">
                    Mark read
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
