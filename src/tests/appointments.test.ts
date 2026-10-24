import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import {
  generateSlots,
  getAvailableSlots,
  createAppointment,
  cancelAppointment,
  updateAppointmentStatus,
} from "@/lib/appointments"

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
  },
}))

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
  beforeEach(() => vi.clearAllMocks())

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
    } as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: "appt-1",
      status: "PENDING",
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
})

describe("cancelAppointment", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sets appointment status to CANCELLED", async () => {
    vi.mocked(prisma.appointment.update).mockResolvedValue({
      id: "appt-1",
      status: "CANCELLED",
    } as never)
    await cancelAppointment("appt-1")
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt-1" },
      data: { status: "CANCELLED" },
    })
  })
})
