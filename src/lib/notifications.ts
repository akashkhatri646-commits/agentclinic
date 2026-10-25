import { prisma } from "./prisma"

export type NotificationInput = {
  userId: string
  message: string
  href?: string
}

export async function createNotification({ userId, message, href }: NotificationInput) {
  return prisma.notification.create({ data: { userId, message, href } })
}

/**
 * Fail-soft wrapper used by appointment and discharge flows. A notification is
 * a courtesy, so a failed write is logged and swallowed rather than allowed to
 * undo or block the booking, confirmation, cancellation, or discharge that
 * triggered it. Duplicate recipients are collapsed to a single notification.
 */
export async function notifyUsers(
  userIds: (string | null | undefined)[],
  message: string,
  href?: string
): Promise<void> {
  const recipients = Array.from(new Set(userIds.filter((id): id is string => !!id)))
  await Promise.all(
    recipients.map(async (userId) => {
      try {
        await createNotification({ userId, message, href })
      } catch (e) {
        console.error("Failed to create notification", e)
      }
    })
  )
}

export async function getNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } })
}

/** Marks one notification read. Only affects rows owned by `userId`; returns true if one changed. */
export async function markAsRead(id: string, userId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  })
  return result.count > 0
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
  return result.count
}
