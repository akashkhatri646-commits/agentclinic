import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { notifyUsers } from "@/lib/notifications"
import {
  generateSlots,
  getAvailableSlots,
  createAppointment,
  cancelAppointment,
  updateAppointmentStatus,
} from "@/lib/appointments"

vi.mock("@/lib/notifications", () => ({ notifyUsers: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ailment: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

function apptRow(status: string) {
  return {
    id: "appt-1",
    status,
    staffId: "staff-1",
    ailmentId: "ailment-1",
    scheduledAt: new Date("2026-10-26T10:00:00.000Z"),
    agent: { userId: "agent-user-1" },
  }
}

const monday = new Date("2026-10-26T00:00:00.000Z") // a Monday

describe("generateSlots", () => {
  it("returns 8 slots between 09:00 and 16:00", () => {
    const slots = generateSlots(monday)
    expect(slots).toHaveLength(8)
    expect(slots[0].getHours()).toBe(9)
    expect(slots[7].getHours()).toBe(16)
  })
})

describe("getAvailableSlots", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns all 8 slots when no appointments are booked", async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    const slots = await getAvailableSlots("staff-1", monday)
    expect(slots).toHaveLength(8)
  })

  it("excludes slots already taken by PENDING or CONFIRMED appointments", async () => {
    const bookedAt = new Date(monday)
    bookedAt.setHours(9, 0, 0, 0)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { scheduledAt: bookedAt } as never,
    ])
    const slots = await getAvailableSlots("staff-1", monday)
    expect(slots).toHaveLength(7)
    expect(slots.some((s) => s.getHours() === 9)).toBe(false)
  })
})

describe("createAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "staff-1", role: "STAFF" } as never)
  })

  const bookingInput = {
    agentId: "agent-1",
    staffId: "staff-1",
    ailmentId: "ailment-1",
    therapyId: "therapy-1",
    scheduledAt: new Date(),
  }

  it("throws when the ailment has been discharged", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue({
      id: "ailment-1",
      therapyId: "therapy-1",
      status: "RESOLVED",
    } as never)
    await expect(createAppointment(bookingInput)).rejects.toThrow("has been discharged")
    expect(prisma.appointment.create).not.toHaveBeenCalled()
  })

  it.each([["AGENT"], [null]])("throws when the practitioner is not staff (%s)", async (role) => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue({
      id: "ailment-1",
      therapyId: "therapy-1",
      status: "IN_TREATMENT",
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(role ? ({ id: "x", role } as never) : null)
    await expect(createAppointment(bookingInput)).rejects.toThrow("valid practitioner")
    expect(prisma.appointment.create).not.toHaveBeenCalled()
  })

  it("throws when the ailment has no therapy assigned", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue({
      id: "ailment-1",
      therapyId: null,
    } as never)
    await expect(
      createAppointment({
        agentId: "agent-1",
        staffId: "staff-1",
        ailmentId: "ailment-1",
        therapyId: "therapy-1",
        scheduledAt: new Date(),
      })
    ).rejects.toThrow("must have a therapy assigned")
  })

  it("throws when an active appointment already exists for the ailment", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue({
      id: "ailment-1",
      therapyId: "therapy-1",
    } as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: "appt-1",
    } as never)
    await expect(
      createAppointment({
        agentId: "agent-1",
        staffId: "staff-1",
        ailmentId: "ailment-1",
        therapyId: "therapy-1",
        scheduledAt: new Date(),
      })
    ).rejects.toThrow("active appointment already exists")
  })

  it("creates the appointment with PENDING status when valid", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue({
      id: "ailment-1",
      therapyId: "therapy-1",
      agent: { name: "GPT", userId: "agent-user-1" },
    } as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: "appt-1",
      status: "PENDING",
      scheduledAt: new Date("2026-10-26T10:00:00.000Z"),
    } as never)
    const result = await createAppointment({
      agentId: "agent-1",
      staffId: "staff-1",
      ailmentId: "ailment-1",
      therapyId: "therapy-1",
      scheduledAt: new Date(),
    })
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) })
    )
    expect(result.status).toBe("PENDING")
  })

  it("notifies the practitioner and the agent when booked", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue({
      id: "ailment-1",
      therapyId: "therapy-1",
      agent: { name: "GPT", userId: "agent-user-1" },
    } as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: "appt-1",
      scheduledAt: new Date("2026-10-26T10:00:00.000Z"),
    } as never)
    await createAppointment({
      agentId: "agent-1",
      staffId: "staff-1",
      ailmentId: "ailment-1",
      therapyId: "therapy-1",
      scheduledAt: new Date(),
    })
    const recipients = vi.mocked(notifyUsers).mock.calls.map((c) => c[0])
    expect(recipients).toEqual([["staff-1"], ["agent-user-1"]])
  })
})

describe("cancelAppointment", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sets appointment status to CANCELLED", async () => {
    vi.mocked(prisma.appointment.update).mockResolvedValue(apptRow("CANCELLED") as never)
    await cancelAppointment("appt-1")
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "appt-1" }, data: { status: "CANCELLED" } })
    )
  })

  it("notifies only the other party when the agent cancels", async () => {
    vi.mocked(prisma.appointment.update).mockResolvedValue(apptRow("CANCELLED") as never)
    await cancelAppointment("appt-1", "agent-user-1")
    expect(notifyUsers).toHaveBeenCalledWith(["staff-1"], expect.stringContaining("cancelled"), "/dashboard/ailments/ailment-1")
  })

  it("notifies only the other party when staff cancels", async () => {
    vi.mocked(prisma.appointment.update).mockResolvedValue(apptRow("CANCELLED") as never)
    await cancelAppointment("appt-1", "staff-1")
    expect(notifyUsers).toHaveBeenCalledWith(["agent-user-1"], expect.stringContaining("cancelled"), "/dashboard/ailments/ailment-1")
  })
})

describe("updateAppointmentStatus", () => {
  beforeEach(() => vi.clearAllMocks())

  it("notifies the agent when an appointment is confirmed", async () => {
    vi.mocked(prisma.appointment.update).mockResolvedValue(apptRow("CONFIRMED") as never)
    await updateAppointmentStatus("appt-1", "CONFIRMED", "staff-1")
    expect(notifyUsers).toHaveBeenCalledWith(["agent-user-1"], expect.stringContaining("confirmed"), "/dashboard/ailments/ailment-1")
  })

  it("sends no notification for a PENDING status", async () => {
    vi.mocked(prisma.appointment.update).mockResolvedValue(apptRow("PENDING") as never)
    await updateAppointmentStatus("appt-1", "PENDING")
    expect(notifyUsers).not.toHaveBeenCalled()
  })
})
