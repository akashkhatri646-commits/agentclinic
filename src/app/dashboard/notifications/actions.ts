"use server"

import { auth } from "@/lib/auth"
import { markAsRead, markAllAsRead } from "@/lib/notifications"
import { redirect } from "next/navigation"

// Both actions are scoped to the signed-in user inside the lib, so one user
// can never mark another user's notifications as read.

export async function markNotificationReadAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const id = formData.get("notificationId") as string
  if (id) await markAsRead(id, session.user.id)
  redirect("/dashboard/notifications")
}

export async function markAllReadAction() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  await markAllAsRead(session.user.id)
  redirect("/dashboard/notifications")
}
