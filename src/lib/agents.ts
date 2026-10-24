import { prisma } from "./prisma"

export async function getAgentByUserId(userId: string) {
  return prisma.agent.findUnique({ where: { userId } })
}

export async function getAgentById(id: string) {
  return prisma.agent.findUnique({ where: { id } })
}

export async function getAllAgents() {
  return prisma.agent.findMany({ orderBy: { createdAt: "desc" } })
}
