import { prisma } from "./prisma"
import { Prisma } from "@prisma/client"

export type AilmentSeverity = "LOW" | "MEDIUM" | "HIGH"
export type AilmentStatus = "OPEN" | "IN_TREATMENT" | "RESOLVED"

// Narrowed type: severity/status are validated on write so we assert the union here
type RawAilmentWithAgent = Prisma.AilmentGetPayload<{ include: { agent: true } }>
export type AilmentWithAgent = Omit<RawAilmentWithAgent, "severity" | "status"> & {
  severity: AilmentSeverity
  status: AilmentStatus
}

export async function getAilmentsByAgentId(agentId: string): Promise<AilmentWithAgent[]> {
  const rows = await prisma.ailment.findMany({
    where: { agentId },
    include: { agent: true },
    orderBy: { createdAt: "desc" },
  })
  return rows as AilmentWithAgent[]
}

export async function getAllAilments(): Promise<AilmentWithAgent[]> {
  const rows = await prisma.ailment.findMany({
    include: { agent: true },
    orderBy: { createdAt: "desc" },
  })
  return rows as AilmentWithAgent[]
}

export async function createAilment(data: {
  agentId: string
  description: string
  severity: AilmentSeverity
}) {
  return prisma.ailment.create({
    data: { ...data, status: "OPEN" },
  })
}
