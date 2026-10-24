import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { getAilmentsByAgentId, getAllAilments, createAilment, assignTherapy } from "@/lib/ailments"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ailment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
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
