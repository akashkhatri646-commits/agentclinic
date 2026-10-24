import { prisma } from "./prisma"
import { Prisma } from "@prisma/client"

export type AilmentSeverity = "LOW" | "MEDIUM" | "HIGH"
export type AilmentStatus = "OPEN" | "IN_TREATMENT" | "RESOLVED"

const ailmentInclude = { agent: true, therapy: true } as const

type RawAilmentFull = Prisma.AilmentGetPayload<{ include: typeof ailmentInclude }>
export type AilmentWithAgent = Omit<RawAilmentFull, "severity" | "status"> & {
  severity: AilmentSeverity
  status: AilmentStatus
}

export async function getAilmentsByAgentId(agentId: string): Promise<AilmentWithAgent[]> {
  const rows = await prisma.ailment.findMany({
    where: { agentId },
    include: ailmentInclude,
    orderBy: { createdAt: "desc" },
  })
  return rows as AilmentWithAgent[]
}

export async function getAllAilments(): Promise<AilmentWithAgent[]> {
  const rows = await prisma.ailment.findMany({
    include: ailmentInclude,
    orderBy: { createdAt: "desc" },
  })
  return rows as AilmentWithAgent[]
}

export async function getAilmentById(id: string): Promise<AilmentWithAgent | null> {
  const row = await prisma.ailment.findUnique({
    where: { id },
    include: ailmentInclude,
  })
  return row as AilmentWithAgent | null
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

export async function assignTherapy(ailmentId: string, therapyId: string) {
  return prisma.ailment.update({
    where: { id: ailmentId },
    data: { therapyId, status: "IN_TREATMENT" },
  })
}
