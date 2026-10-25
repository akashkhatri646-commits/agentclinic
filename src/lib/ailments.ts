import { prisma } from "./prisma"
import { Prisma } from "@prisma/client"
import { notifyUsers } from "./notifications"

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

export const MAX_DISCHARGE_NOTE_LENGTH = 2000

export async function dischargeAilment(ailmentId: string, note: string) {
  const trimmed = note.trim()
  if (!trimmed) throw new Error("A discharge note is required.")
  if (trimmed.length > MAX_DISCHARGE_NOTE_LENGTH) {
    throw new Error(`Discharge note must be ${MAX_DISCHARGE_NOTE_LENGTH} characters or fewer.`)
  }

  const ailment = await prisma.ailment.findUnique({
    where: { id: ailmentId },
    include: { agent: true },
  })
  if (!ailment) throw new Error("Ailment not found.")
  if (ailment.status === "RESOLVED") throw new Error("This ailment has already been discharged.")

  const now = new Date()
  // One transaction: the discharge and the cancellation of upcoming sessions succeed or fail together.
  const [updated] = await prisma.$transaction([
    prisma.ailment.update({
      where: { id: ailmentId },
      data: { status: "RESOLVED", dischargedAt: now, dischargeNote: trimmed },
    }),
    prisma.appointment.updateMany({
      where: {
        ailmentId,
        status: { in: ["PENDING", "CONFIRMED"] },
        scheduledAt: { gte: now },
      },
      data: { status: "CANCELLED" },
    }),
  ])

  await notifyUsers(
    [ailment.agent?.userId],
    "You have been discharged. Review your treatment history.",
    `/dashboard/ailments/${ailmentId}`
  )
  return updated
}

export async function reopenAilment(ailmentId: string) {
  const ailment = await prisma.ailment.findUnique({ where: { id: ailmentId } })
  if (!ailment) throw new Error("Ailment not found.")
  if (ailment.status !== "RESOLVED") throw new Error("Only discharged ailments can be reopened.")

  return prisma.ailment.update({
    where: { id: ailmentId },
    data: {
      status: ailment.therapyId ? "IN_TREATMENT" : "OPEN",
      dischargedAt: null,
      dischargeNote: null,
    },
  })
}
