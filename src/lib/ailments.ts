import { prisma } from "./prisma"

export type AilmentSeverity = "LOW" | "MEDIUM" | "HIGH"
export type AilmentStatus = "OPEN" | "IN_TREATMENT" | "RESOLVED"

export async function getAilmentsByAgentId(agentId: string) {
  return prisma.ailment.findMany({
    where: { agentId },
    include: { agent: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function getAllAilments() {
  return prisma.ailment.findMany({
    include: { agent: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function createAilment(data: {
  agentId: string
  description: string
  severity: AilmentSeverity
}) {
  return prisma.ailment.create({
    data: { ...data, status: "OPEN" as AilmentStatus },
  })
}
