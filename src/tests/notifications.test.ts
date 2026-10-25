import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import {
  createNotification,
  notifyUsers,
  getNotificationsForUser,
  getUnreadCount,
  getUnreadCountSafe,
  markAsRead,
  markAllAsRead,
} from "@/lib/notifications"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

describe("createNotification", () => {
  beforeEach(() => vi.clearAllMocks())

  it("stores the message, href and owner", async () => {
    await createNotification({ userId: "u1", message: "Hi", href: "/x" })
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: "u1", message: "Hi", href: "/x" },
    })
  })
})

describe("notifyUsers", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates one notification per distinct recipient and skips empty ids", async () => {
    await notifyUsers(["u1", "u2", "u1", null, undefined], "Hello", "/h")
    expect(prisma.notification.create).toHaveBeenCalledTimes(2)
  })

  it("does not throw when a write fails, and still notifies the others", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(prisma.notification.create)
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({} as never)
    await expect(notifyUsers(["u1", "u2"], "Hello")).resolves.toBeUndefined()
    expect(prisma.notification.create).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe("reading notifications", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lists only the given user's notifications, newest first", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([])
    await getNotificationsForUser("u1")
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { createdAt: "desc" },
    })
  })

  it("counts only unread notifications for the user", async () => {
    vi.mocked(prisma.notification.count).mockResolvedValue(3)
    expect(await getUnreadCount("u1")).toBe(3)
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: "u1", readAt: null },
    })
  })
})

describe("getUnreadCountSafe", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the count when the query succeeds", async () => {
    vi.mocked(prisma.notification.count).mockResolvedValue(5)
    expect(await getUnreadCountSafe("u1")).toBe(5)
  })

  it("returns 0 instead of throwing when the query fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(prisma.notification.count).mockRejectedValue(new Error("no such table"))
    await expect(getUnreadCountSafe("u1")).resolves.toBe(0)
    spy.mockRestore()
  })
})

describe("marking as read", () => {
  beforeEach(() => vi.clearAllMocks())

  it("scopes the update to the owning user", async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 })
    expect(await markAsRead("n1", "u1")).toBe(true)
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", userId: "u1", readAt: null },
      data: { readAt: expect.any(Date) },
    })
  })

  it("returns false for another user's notification", async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 0 })
    expect(await markAsRead("n1", "someone-else")).toBe(false)
  })

  it("marks all of the user's unread notifications read", async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 4 })
    expect(await markAllAsRead("u1")).toBe(4)
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", readAt: null },
      data: { readAt: expect.any(Date) },
    })
  })
})
