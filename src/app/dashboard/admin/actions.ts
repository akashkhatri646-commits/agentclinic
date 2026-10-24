"use server"

import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export async function updateUserRoleAction(
  userId: string,
  newRole: string
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!isAdmin(session.user.role)) redirect("/dashboard")

  if (userId === session.user.id) {
    return { error: "You cannot change your own role." }
  }

  const validRoles = ["AGENT", "STAFF", "ADMIN"]
  if (!validRoles.includes(newRole)) {
    return { error: "Invalid role." }
  }

  await prisma.user.update({ where: { id: userId }, data: { role: newRole } })
  redirect("/dashboard/admin/users")
}
