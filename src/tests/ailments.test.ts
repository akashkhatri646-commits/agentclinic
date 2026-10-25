import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { notifyUsers } from "@/lib/notifications"
import {
  getAilmentsByAgentId,
  getAllAilments,
  createAilment,
  assignTherapy,
  dischargeAilment,
  reopenAilment,
} from "@/lib/ailments"

vi.mock("@/lib/notifications", () => ({ notifyUsers: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ailment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    appointment: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const mockAgent = {
  id: "agent-1",
  name: "GPT-4o-mini",
  model: "gpt-4o-mini",
  ownerNotes: null,
  userId: "user-1",
  createdAt: new Date("2026-01-01"),
}

const mockAilment = {
  id: "ailment-1",
  agentId: "agent-1",
  description: "Context window anxiety",
  severity: "HIGH",
  status: "OPEN",
  createdAt: new Date("2026-01-01"),
  therapyId: null,
  dischargedAt: null,
  dischargeNote: null,
  agent: mockAgent,
  therapy: null,
}

describe("getAilmentsByAgentId", () => {
  beforeEach(() => vi.clearAllMocks())

  it("queries only ailments belonging to the given agent", async () => {
    vi.mocked(prisma.ailment.findMany).mockResolvedValue([mockAilment])
    await getAilmentsByAgentId("agent-1")
    expect(prisma.ailment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "agent-1" } })
    )
  })

  it("returns ailments for the agent", async () => {
    vi.mocked(prisma.ailment.findMany).mockResolvedValue([mockAilment])
    const result = await getAilmentsByAgentId("agent-1")
    expect(result).toHaveLength(1)
    expect(result[0].agentId).toBe("agent-1")
  })

  it("returns an empty list for an agent with no ailments (ownership check)", async () => {
    vi.mocked(prisma.ailment.findMany).mockResolvedValue([])
    const result = await getAilmentsByAgentId("other-agent")
    expect(result).toHaveLength(0)
  })
})

describe("createAilment", () => {
  beforeEach(() => vi.clearAllMocks())

  it("persists a new ailment with status OPEN", async () => {
    vi.mocked(prisma.ailment.create).mockResolvedValue(mockAilment)
    await createAilment({
      agentId: "agent-1",
      description: "Context window anxiety",
      severity: "HIGH",
    })
    expect(prisma.ailment.create).toHaveBeenCalledWith({
      data: {
        agentId: "agent-1",
        description: "Context window anxiety",
        severity: "HIGH",
        status: "OPEN",
      },
    })
  })

  it("returns the created ailment", async () => {
    vi.mocked(prisma.ailment.create).mockResolvedValue(mockAilment)
    const result = await createAilment({
      agentId: "agent-1",
      description: "Context window anxiety",
      severity: "HIGH",
    })
    expect(result.id).toBe("ailment-1")
    expect(result.status).toBe("OPEN")
  })
})

describe("getAllAilments", () => {
  beforeEach(() => vi.clearAllMocks())

  it("includes agent data in results", async () => {
    vi.mocked(prisma.ailment.findMany).mockResolvedValue([mockAilment])
    await getAllAilments()
    expect(prisma.ailment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ agent: true }) })
    )
  })
})

describe("assignTherapy", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sets therapyId on the ailment", async () => {
    vi.mocked(prisma.ailment.update).mockResolvedValue({
      ...mockAilment,
      therapyId: "therapy-1",
      status: "IN_TREATMENT",
    } as never)
    await assignTherapy("ailment-1", "therapy-1")
    expect(prisma.ailment.update).toHaveBeenCalledWith({
      where: { id: "ailment-1" },
      data: { therapyId: "therapy-1", status: "IN_TREATMENT" },
    })
  })

  it("updates status to IN_TREATMENT", async () => {
    vi.mocked(prisma.ailment.update).mockResolvedValue({
      ...mockAilment,
      therapyId: "therapy-1",
      status: "IN_TREATMENT",
    } as never)
    const result = await assignTherapy("ailment-1", "therapy-1")
    expect(result.status).toBe("IN_TREATMENT")
  })
})

describe("dischargeAilment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$transaction).mockImplementation((async (ops: Promise<unknown>[]) =>
      Promise.all(ops)) as never)
    vi.mocked(prisma.ailment.update).mockResolvedValue({ ...mockAilment, status: "RESOLVED" } as never)
    vi.mocked(prisma.appointment.updateMany).mockResolvedValue({ count: 1 } as never)
  })

  const inTreatment = { ...mockAilment, status: "IN_TREATMENT", therapyId: "therapy-1" }

  it("marks the ailment RESOLVED with a trimmed note and discharge date", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue(inTreatment as never)
    await dischargeAilment("ailment-1", "  Fully recovered.  ")
    expect(prisma.ailment.update).toHaveBeenCalledWith({
      where: { id: "ailment-1" },
      data: {
        status: "RESOLVED",
        dischargedAt: expect.any(Date),
        dischargeNote: "Fully recovered.",
      },
    })
  })

  it("cancels every pending and confirmed appointment, including past-dated ones", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue(inTreatment as never)
    await dischargeAilment("ailment-1", "Done.")
    expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        ailmentId: "ailment-1",
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      data: { status: "CANCELLED" },
    })
  })

  it("notifies the agent's user", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue(inTreatment as never)
    await dischargeAilment("ailment-1", "Done.")
    expect(notifyUsers).toHaveBeenCalledWith(
      ["user-1"],
      expect.stringContaining("discharged"),
      "/dashboard/ailments/ailment-1"
    )
  })

  it("rejects an empty or whitespace-only note", async () => {
    await expect(dischargeAilment("ailment-1", "   ")).rejects.toThrow("discharge note is required")
    expect(prisma.ailment.update).not.toHaveBeenCalled()
  })

  it("rejects an over-long note", async () => {
    await expect(dischargeAilment("ailment-1", "x".repeat(2001))).rejects.toThrow("2000 characters")
  })

  it("rejects discharging an already-resolved ailment", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue({ ...mockAilment, status: "RESOLVED" } as never)
    await expect(dischargeAilment("ailment-1", "Again")).rejects.toThrow("already been discharged")
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("rejects an unknown ailment", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue(null)
    await expect(dischargeAilment("nope", "Note")).rejects.toThrow("not found")
  })
})

describe("reopenAilment", () => {
  beforeEach(() => vi.clearAllMocks())

  it("restores IN_TREATMENT when a therapy is assigned and clears discharge fields", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue({
      ...mockAilment,
      status: "RESOLVED",
      therapyId: "therapy-1",
    } as never)
    vi.mocked(prisma.ailment.update).mockResolvedValue(mockAilment as never)
    await reopenAilment("ailment-1")
    expect(prisma.ailment.update).toHaveBeenCalledWith({
      where: { id: "ailment-1" },
      data: { status: "IN_TREATMENT", dischargedAt: null, dischargeNote: null },
    })
  })

  it("restores OPEN when no therapy is assigned", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue({ ...mockAilment, status: "RESOLVED" } as never)
    vi.mocked(prisma.ailment.update).mockResolvedValue(mockAilment as never)
    await reopenAilment("ailment-1")
    expect(prisma.ailment.update).toHaveBeenCalledWith({
      where: { id: "ailment-1" },
      data: { status: "OPEN", dischargedAt: null, dischargeNote: null },
    })
  })

  it("rejects reopening an ailment that is not discharged", async () => {
    vi.mocked(prisma.ailment.findUnique).mockResolvedValue(mockAilment as never)
    await expect(reopenAilment("ailment-1")).rejects.toThrow("Only discharged")
    expect(prisma.ailment.update).not.toHaveBeenCalled()
  })
})
