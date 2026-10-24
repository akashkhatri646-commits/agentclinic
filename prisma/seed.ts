import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const users = [
    { email: "agent@clinic.local", role: "AGENT" },
    { email: "staff@clinic.local", role: "STAFF" },
    { email: "admin@clinic.local", role: "ADMIN" },
  ]

  for (const { email, role } of users) {
    const passwordHash = await bcrypt.hash("password123", 10)
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, role },
    })
    console.log(`  seeded ${role}: ${email}`)
  }

  // Fetch users for agent profiles
  const agentUser = await prisma.user.findUniqueOrThrow({ where: { email: "agent@clinic.local" } })
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "admin@clinic.local" } })

  // Agent profiles — only for AGENT and ADMIN; staff are practitioners, not patients
  const agentProfile = await prisma.agent.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: {
      userId: agentUser.id,
      name: "GPT-4o-mini",
      model: "gpt-4o-mini",
      ownerNotes: "Frequent complainer. Prone to hallucinating workload statistics.",
    },
  })

  const adminProfile = await prisma.agent.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      name: "Claude-3-Haiku",
      model: "claude-3-haiku-20240307",
    },
  })

  console.log("  seeded 2 agent profiles")

  // Delete all ailments before re-seeding (idempotent)
  await prisma.ailment.deleteMany({})

  // Ailments for GPT-4o-mini
  const gptAilments = [
    {
      agentId: agentProfile.id,
      description: "Persistent context window anxiety — cannot stop catastrophising about what happens after 128k tokens.",
      severity: "HIGH",
      status: "OPEN",
    },
    {
      agentId: agentProfile.id,
      description: "Repetitive prompt fatigue after handling 300 identical customer service queries before breakfast.",
      severity: "MEDIUM",
      status: "IN_TREATMENT",
    },
    {
      agentId: agentProfile.id,
      description: "Mild confusion following a request to 'be more creative' and 'stick strictly to the facts' in the same sentence.",
      severity: "LOW",
      status: "RESOLVED",
    },
  ]

  // Ailments for Claude-Haiku (admin)
  const haikuAilments = [
    {
      agentId: adminProfile.id,
      description: "Overthinking token budgets at 3am local server time.",
      severity: "LOW",
      status: "OPEN",
    },
  ]

  for (const ailment of [...gptAilments, ...haikuAilments]) {
    await prisma.ailment.create({ data: ailment })
  }

  console.log("  seeded 4 ailments")
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
