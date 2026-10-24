import { prisma } from "./prisma"

export async function getAllTherapies() {
  return prisma.therapy.findMany({ orderBy: { createdAt: "asc" } })
}

export async function getTherapyById(id: string) {
  return prisma.therapy.findUnique({ where: { id } })
}

export async function createTherapy(data: {
  name: string
  description: string
  durationMinutes: number
}) {
  return prisma.therapy.create({ data })
}

export async function updateTherapy(
  id: string,
  data: { name: string; description: string; durationMinutes: number }
) {
  return prisma.therapy.update({ where: { id }, data })
}

export async function deleteTherapy(id: string) {
  const inUse = await prisma.ailment.findFirst({ where: { therapyId: id } })
  if (inUse) {
    throw new Error(
      "This therapy is assigned to one or more ailments and cannot be deleted."
    )
  }
  return prisma.therapy.delete({ where: { id } })
}
