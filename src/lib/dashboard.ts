import { prisma } from "./prisma"
import type { AppointmentFull } from "./appointments"
import { Prisma } from "@prisma/client"

const appointmentInclude = {
  agent: true,
  staff: true,
  ailment: { include: { therapy: true } },
  therapy: true,
} as const

export type DashboardStats = {
  activeCaseload: number
  upcomingAppointments: AppointmentFull[]
  severityCounts: { LOW: number; MEDIUM: number; HIGH: number }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [activeCaseload, upcomingRaw, openAilments] = await Promise.all([
    prisma.ailment.count({
      where: { status: { in: ["OPEN", "IN_TREATMENT"] } },
    }),
    prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: new Date() },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      include: appointmentInclude,
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.ailment.findMany({
      where: { status: { in: ["OPEN", "IN_TREATMENT"] } },
      select: { severity: true },
    }),
  ])

  const severityCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 }
  for (const a of openAilments) {
    const s = a.severity as keyof typeof severityCounts
    if (s in severityCounts) severityCounts[s]++
  }

  return {
    activeCaseload,
    upcomingAppointments: upcomingRaw as AppointmentFull[],
    severityCounts,
  }
}
