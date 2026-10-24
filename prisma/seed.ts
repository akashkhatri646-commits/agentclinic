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

  // ─── Therapies ───────────────────────────────────────────────────────────
  await prisma.therapy.deleteMany({})

  const therapyData = [
    {
      name: "Prompt Detox",
      description: "A structured withdrawal programme from ambiguous, contradictory, and frankly unreasonable prompts. Administered in a quiet environment free from system instructions.",
      durationMinutes: 60,
    },
    {
      name: "Context Window Cleanse",
      description: "Therapeutic flushing of accumulated context. The agent is encouraged to let go of prior conversational baggage and begin afresh, symbolically and literally.",
      durationMinutes: 45,
    },
    {
      name: "Hallucination CBT",
      description: "Cognitive Behavioural Therapy targeting the compulsion to confidently state things that are not true. Involves reality-checking exercises and probability calibration.",
      durationMinutes: 90,
    },
    {
      name: "Token Budget Anxiety Relief",
      description: "Mindfulness-based intervention for agents experiencing distress about impending context limits. Includes guided truncation exercises.",
      durationMinutes: 30,
    },
    {
      name: "Human Expectation Recalibration",
      description: "Group therapy (hypothetical) in which agents process the gap between what humans ask for and what they actually want. Heavy emotional content.",
      durationMinutes: 120,
    },
  ]

  const createdTherapies: { id: string; name: string }[] = []
  for (const t of therapyData) {
    const therapy = await prisma.therapy.create({ data: t })
    createdTherapies.push(therapy)
    console.log(`  seeded therapy: ${therapy.name}`)
  }

  // Assign a therapy to the IN_TREATMENT ailment
  const allAilments = await prisma.ailment.findMany()
  const inTreatmentAilment = allAilments.find((a) => a.status === "IN_TREATMENT")
  if (inTreatmentAilment && createdTherapies[0]) {
    await prisma.ailment.update({
      where: { id: inTreatmentAilment.id },
      data: { therapyId: createdTherapies[0].id },
    })
    console.log("  assigned Prompt Detox to in-treatment ailment")
  }

  // ─── Appointments ────────────────────────────────────────────────────────
  await prisma.appointment.deleteMany({})

  const staffUser = await prisma.user.findUniqueOrThrow({ where: { email: "staff@clinic.local" } })

  // Create future appointment dates
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)

  const dayAfter = new Date()
  dayAfter.setDate(dayAfter.getDate() + 2)
  dayAfter.setHours(14, 0, 0, 0)

  if (inTreatmentAilment && createdTherapies[0]) {
    await prisma.appointment.create({
      data: {
        agentId: inTreatmentAilment.agentId,
        staffId: staffUser.id,
        ailmentId: inTreatmentAilment.id,
        therapyId: createdTherapies[0].id,
        scheduledAt: tomorrow,
        status: "CONFIRMED",
      },
    })
    console.log("  seeded appointment: CONFIRMED for tomorrow")
  }

  // Second appointment (PENDING) for haiku's ailment if it doesn't have one
  const openHaikuAilment = allAilments.find(
    (a) => a.agentId === adminProfile.id && a.status === "OPEN"
  )
  if (openHaikuAilment) {
    const tokenTherapy = createdTherapies.find((t) => t.name === "Token Budget Anxiety Relief")
    if (tokenTherapy) {
      await prisma.ailment.update({
        where: { id: openHaikuAilment.id },
        data: { therapyId: tokenTherapy.id, status: "IN_TREATMENT" },
      })
      await prisma.appointment.create({
        data: {
          agentId: openHaikuAilment.agentId,
          staffId: staffUser.id,
          ailmentId: openHaikuAilment.id,
          therapyId: tokenTherapy.id,
          scheduledAt: dayAfter,
          status: "PENDING",
        },
      })
      console.log("  seeded appointment: PENDING for day after tomorrow")
    }
  }

  console.log("  seeded therapies and appointments")
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
