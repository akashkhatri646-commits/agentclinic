import { prisma } from "./prisma"
import { Prisma } from "@prisma/client"

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
  const ailment = await prisma.ailment.findUnique({ where: { id: data.ailmentId } })
  if (!ailment?.therapyId) {
    throw new Error("Ailment must have a therapy assigned before booking.")
  }

  const existing = await prisma.appointment.findFirst({
    where: { ailmentId: data.ailmentId, status: { in: ["PENDING", "CONFIRMED"] } },
  })
  if (existing) {
    throw new Error("An active appointment already exists for this ailment.")
  }

  return prisma.appointment.create({ data: { ...data, status: "PENDING" } })
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  return prisma.appointment.update({ where: { id }, data: { status } })
}

export async function cancelAppointment(id: string) {
  return updateAppointmentStatus(id, "CANCELLED")
}
