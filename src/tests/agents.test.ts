import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { getAgentByUserId, getAgentById, getAllAgents } from "@/lib/agents"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
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

describe("getAgentByUserId", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls findUnique with the correct userId", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(mockAgent)
    await getAgentByUserId("user-1")
    expect(prisma.agent.findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } })
  })

  it("returns the agent when found", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(mockAgent)
    const result = await getAgentByUserId("user-1")
    expect(result).toEqual(mockAgent)
  })

  it("returns null for an unknown userId", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null)
    const result = await getAgentByUserId("unknown")
    expect(result).toBeNull()
  })
})

describe("getAgentById", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls findUnique with the correct id", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(mockAgent)
    await getAgentById("agent-1")
    expect(prisma.agent.findUnique).toHaveBeenCalledWith({ where: { id: "agent-1" } })
  })

  it("returns null for a non-existent id without throwing", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null)
    const result = await getAgentById("nonexistent")
    expect(result).toBeNull()
  })
})

describe("getAllAgents", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns all agents ordered by createdAt desc", async () => {
    vi.mocked(prisma.agent.findMany).mockResolvedValue([mockAgent])
    const result = await getAllAgents()
    expect(prisma.agent.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
    })
    expect(result).toHaveLength(1)
  })
})
