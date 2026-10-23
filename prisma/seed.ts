import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const seeds = [
    { email: "agent@clinic.local", role: "AGENT" },
    { email: "staff@clinic.local", role: "STAFF" },
    { email: "admin@clinic.local", role: "ADMIN" },
  ]

  for (const { email, role } of seeds) {
    const passwordHash = await bcrypt.hash("password123", 10)
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, role },
    })
    console.log(`  seeded ${role}: ${email}`)
  }
}

main()
  .then(() => {
    console.log("Seed complete.")
    return prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
