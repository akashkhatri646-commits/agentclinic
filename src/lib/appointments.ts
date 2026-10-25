import { prisma } from "./prisma"
import { Prisma } from "@prisma/client"
import { notifyUsers } from "./notifications"

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED"

const appointmentInclude = {
  agent: true,
  staff: true,
  ailment: { include: { therapy: true } },
  therapy: true,
} as const

type RawAppointment = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>
export type AppointmentFull = Omit<RawAppointment, "status"> & { status: AppointmentStatus }

// 09:00 – 17:00 in 1-hour blocks
const SLOT_START_HOUR = 9
const SLOT_END_HOUR = 17

export function generateSlots(date: Date): Date[] {
  const slots: Date[] = []
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
    const slot = new Date(d)
    slot.setHours(h, 0, 0, 0)
    slots.push(slot)
  }
  return slots
}

export async function getAvailableSlots(staffId: string, date: Date): Promise<Date[]> {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const booked = await prisma.appointment.findMany({
    where: {
      staffId,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: { scheduledAt: true },
  })

  const bookedTimes = new Set(booked.map((a) => a.scheduledAt.getTime()))
  return generateSlots(date).filter((s) => !bookedTimes.has(s.getTime()))
}

export async function getAppointmentsByAgentId(agentId: string): Promise<AppointmentFull[]> {
  const rows = await prisma.appointment.findMany({
    where: { agentId },
    include: appointmentInclude,
    orderBy: { scheduledAt: "asc" },
  })
  return rows as AppointmentFull[]
}

export async function getAppointmentsByStaffId(staffId: string): Promise<AppointmentFull[]> {
  const rows = await prisma.appointment.findMany({
    where: { staffId },
    include: appointmentInclude,
    orderBy: { scheduledAt: "asc" },
  })
  return rows as AppointmentFull[]
}

export async function getAllAppointments(): Promise<AppointmentFull[]> {
  const rows = await prisma.appointment.findMany({
    include: appointmentInclude,
    orderBy: { scheduledAt: "asc" },
  })
  return rows as AppointmentFull[]
}

export async function getAppointmentById(id: string): Promise<AppointmentFull | null> {
  const row = await prisma.appointment.findUnique({
    where: { id },
    include: appointmentInclude,
  })
  return row as AppointmentFull | null
}

export async function getAppointmentsByAilmentId(ailmentId: string): Promise<AppointmentFull[]> {
  const rows = await prisma.appointment.findMany({
    where: { ailmentId },
    include: appointmentInclude,
    orderBy: { scheduledAt: "asc" },
  })
  return rows as AppointmentFull[]
}

export async function getActiveAppointmentByAilmentId(
  ailmentId: string
): Promise<AppointmentFull | null> {
  const row = await prisma.appointment.findFirst({
    where: { ailmentId, status: { in: ["PENDING", "CONFIRMED"] } },
    include: appointmentInclude,
  })
  return row as AppointmentFull | null
}

export async function createAppointment(data: {
  agentId: string
  staffId: string
  ailmentId: string
  therapyId: string
  scheduledAt: Date
}) {
  const ailment = await prisma.ailment.findUnique({
    where: { id: data.ailmentId },
    include: { agent: true },
  })
  if (!ailment?.therapyId) {
    throw new Error("Ailment must have a therapy assigned before booking.")
  }
  if (ailment.status === "RESOLVED") {
    throw new Error("This ailment has been discharged. Ask staff to reopen it before booking.")
  }

  const practitioner = await prisma.user.findUnique({ where: { id: data.staffId } })
  if (!practitioner || (practitioner.role !== "STAFF" && practitioner.role !== "ADMIN")) {
    throw new Error("Please choose a valid practitioner.")
  }

  const existing = await prisma.appointment.findFirst({
    where: { ailmentId: data.ailmentId, status: { in: ["PENDING", "CONFIRMED"] } },
  })
  if (existing) {
    throw new Error("An active appointment already exists for this ailment.")
  }

  const created = await prisma.appointment.create({ data: { ...data, status: "PENDING" } })

  const when = formatWhen(created.scheduledAt)
  await notifyUsers(
    [data.staffId],
    `New appointment booked by ${ailment.agent?.name ?? "an agent"} for ${when}.`,
    `/dashboard/ailments/${data.ailmentId}`
  )
  await notifyUsers(
    [ailment.agent?.userId],
    `Your appointment for ${when} has been booked and is awaiting confirmation.`,
    `/dashboard/ailments/${data.ailmentId}`
  )
  return created
}

function formatWhen(d: Date): string {
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
}

/**
 * `actorUserId` is the user making the change; they are not notified about
 * their own action. Omit it to notify both the agent and the practitioner.
 */
export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  actorUserId?: string
) {
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status },
    include: { agent: true },
  })

  const when = formatWhen(updated.scheduledAt)
  const href = `/dashboard/ailments/${updated.ailmentId}`
  if (status === "CONFIRMED") {
    await notifyUsers([updated.agent?.userId], `Your appointment for ${when} has been confirmed.`, href)
  } else if (status === "CANCELLED") {
    const others = [updated.staffId, updated.agent?.userId].filter((u) => u !== actorUserId)
    await notifyUsers(others, `The appointment for ${when} has been cancelled.`, href)
  }
  return updated
}

export async function cancelAppointment(id: string, actorUserId?: string) {
  return updateAppointmentStatus(id, "CANCELLED", actorUserId)
}
