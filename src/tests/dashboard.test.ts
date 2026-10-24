import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { getDashboardStats } from "@/lib/dashboard"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ailment: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
    },
  },
}))

const mockAppointment = {
  id: "appt-1",
  agentId: "agent-1",
  staffId: "staff-1",
  ailmentId: "ailment-1",
  therapyId: "therapy-1",
  scheduledAt: new Date("2026-11-01T10:00:00Z"),
  status: "CONFIRMED",
  createdAt: new Date("2026-10-01"),
  agent: { id: "agent-1", name: "GPT-4o-mini", model: "gpt-4o-mini", userId: "u1", ownerNotes: null, createdAt: new Date() },
  staff: { id: "staff-1", email: "staff@clinic.local", role: "STAFF", passwordHash: "x", createdAt: new Date() },
  ailment: { id: "ailment-1", therapy: { id: "therapy-1", name: "Prompt Detox", durationMinutes: 60 } },
  therapy: { id: "therapy-1", name: "Prompt Detox", durationMinutes: 60, description: "", createdAt: new Date() },
}

describe("getDashboardStats", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the correct activeCaseload count", async () => {
    vi.mocked(prisma.ailment.count).mockResolvedValue(5)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.ailment.findMany).mockResolvedValue([])
    const stats = await getDashboardStats()
    expect(stats.activeCaseload).toBe(5)
  })

  it("returns the next 5 upcoming appointments", async () => {
    vi.mocked(prisma.ailment.count).mockResolvedValue(0)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([mockAppointment] as never)
    vi.mocked(prisma.ailment.findMany).mockResolvedValue([])
    const stats = await getDashboardStats()
    expect(stats.upcomingAppointments).toHaveLength(1)
    expect(stats.upcomingAppointments[0].id).toBe("appt-1")
  })

  it("returns correct severity counts from open ailments", async () => {
    vi.mocked(prisma.ailment.count).mockResolvedValue(3)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.ailment.findMany).mockResolvedValue([
      { severity: "HIGH" },
      { severity: "HIGH" },
      { severity: "MEDIUM" },
    ] as never)
    const stats = await getDashboardStats()
    expect(stats.severityCounts.HIGH).toBe(2)
    expect(stats.severityCounts.MEDIUM).toBe(1)
    expect(stats.severityCounts.LOW).toBe(0)
  })
})
