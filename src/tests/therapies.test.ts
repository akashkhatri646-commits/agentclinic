import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import {
  getAllTherapies,
  getTherapyById,
  createTherapy,
  updateTherapy,
  deleteTherapy,
} from "@/lib/therapies"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    therapy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ailment: {
      findFirst: vi.fn(),
    },
  },
}))

const mockTherapy = {
  id: "therapy-1",
  name: "Prompt Detox",
  description: "A structured withdrawal from ambiguous prompts.",
  durationMinutes: 60,
  createdAt: new Date("2026-01-01"),
}

describe("createTherapy", () => {
  beforeEach(() => vi.clearAllMocks())

  it("persists a therapy with the provided fields", async () => {
    vi.mocked(prisma.therapy.create).mockResolvedValue(mockTherapy)
    await createTherapy({ name: "Prompt Detox", description: "...", durationMinutes: 60 })
    expect(prisma.therapy.create).toHaveBeenCalledWith({
      data: { name: "Prompt Detox", description: "...", durationMinutes: 60 },
    })
  })

  it("returns the created therapy", async () => {
    vi.mocked(prisma.therapy.create).mockResolvedValue(mockTherapy)
    const result = await createTherapy({
      name: "Prompt Detox",
      description: "...",
      durationMinutes: 60,
    })
    expect(result.id).toBe("therapy-1")
    expect(result.name).toBe("Prompt Detox")
  })
})

describe("updateTherapy", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates the therapy with the given id", async () => {
    const updated = { ...mockTherapy, name: "Updated" }
    vi.mocked(prisma.therapy.update).mockResolvedValue(updated)
    const result = await updateTherapy("therapy-1", {
      name: "Updated",
      description: "...",
      durationMinutes: 45,
    })
    expect(prisma.therapy.update).toHaveBeenCalledWith({
      where: { id: "therapy-1" },
      data: { name: "Updated", description: "...", durationMinutes: 45 },
    })
    expect(result.name).toBe("Updated")
  })
})

describe("deleteTherapy", () => {
  beforeEach(() => vi.clearAllMocks())

  it("deletes the therapy when not in use", async () => {
    vi.mocked(prisma.ailment.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.therapy.delete).mockResolvedValue(mockTherapy)
    await deleteTherapy("therapy-1")
    expect(prisma.therapy.delete).toHaveBeenCalledWith({ where: { id: "therapy-1" } })
  })

  it("throws when the therapy is referenced by an ailment", async () => {
    vi.mocked(prisma.ailment.findFirst).mockResolvedValue({
      id: "ailment-1",
      agentId: "agent-1",
      description: "test",
      severity: "LOW",
      status: "IN_TREATMENT",
      createdAt: new Date(),
      therapyId: "therapy-1",
      dischargedAt: null,
      dischargeNote: null,
    })
    await expect(deleteTherapy("therapy-1")).rejects.toThrow(
      "assigned to one or more ailments"
    )
    expect(prisma.therapy.delete).not.toHaveBeenCalled()
  })
})

describe("getAllTherapies", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns therapies ordered by createdAt asc", async () => {
    vi.mocked(prisma.therapy.findMany).mockResolvedValue([mockTherapy])
    await getAllTherapies()
    expect(prisma.therapy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } })
    )
  })
})
