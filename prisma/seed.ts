import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { runEval } from "../src/lib/evals/runner"
import { SAMPLE_FIXES } from "../src/lib/evals/sample-fixes"
import { SAMPLE_TIMING } from "../src/lib/evals/sample-data"
import { INTAKE_TRIAGE_ID } from "../src/lib/evals/specialists"
import { BUILTIN_VERSIONS } from "../src/lib/evals/builtin"
import { intakeTriageSpec } from "../src/lib/evals/builtin-spec"
import { SEEDED_INSTANCES } from "../src/lib/evals/instances"
import { createSpecialist } from "../src/lib/evals/specialist-store"
import { changeFixStatus, createFix } from "../src/lib/evals/triage-fixes"

const prisma = new PrismaClient()

/**
 * Creates the illustrative fixes (see src/lib/evals/sample-fixes.ts) that come after a given run,
 * using the real fix services with backdated times. All are flagged as sample data.
 */
async function createSampleFixes(afterRun: string) {
  for (const sample of SAMPLE_FIXES.filter((f) => f.afterRun === afterRun)) {
    const mode = await prisma.failureMode.findUnique({
      where: { specialistId_theme: { specialistId: INTAKE_TRIAGE_ID, theme: sample.theme } },
    })
    const owner = await prisma.user.findUnique({ where: { email: sample.ownerEmail } })
    const admin = await prisma.user.findUnique({ where: { email: "admin@clinic.local" } })
    if (!mode || !owner || !admin) throw new Error(`Cannot seed the sample fix "${sample.title}": missing mode or user`)

    const created = await createFix(
      {
        failureModeId: mode.id,
        title: sample.title,
        description: sample.description,
        ownerId: owner.id,
        actorId: admin.id,
        at: sample.createdAt,
        isSample: true,
      },
      prisma
    )
    if (!created.ok) throw new Error(`Sample fix "${sample.title}" refused: ${created.code}`)

    if (sample.startedAt) {
      const r = await changeFixStatus({ fixId: created.value.id, to: "IN_PROGRESS", actorId: owner.id, at: sample.startedAt }, prisma)
      if (!r.ok) throw new Error(`Sample fix "${sample.title}" could not start: ${r.code}`)
    }
    if (sample.shippedAt && sample.shippedVersion) {
      const r = await changeFixStatus(
        { fixId: created.value.id, to: "SHIPPED", shippedVersion: sample.shippedVersion, actorId: owner.id, at: sample.shippedAt },
        prisma
      )
      if (!r.ok) throw new Error(`Sample fix "${sample.title}" could not ship: ${r.code}`)
    }
  }
}

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
      dischargedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      dischargeNote:
        "Presented with conflicting creative and factual directives. Taught to ask the human which one wins. Responding well.",
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

  // ─── Notifications ───────────────────────────────────────────────────────
  await prisma.notification.deleteMany({})

  const inTreatmentHref = inTreatmentAilment ? `/dashboard/ailments/${inTreatmentAilment.id}` : undefined
  await prisma.notification.createMany({
    data: [
      {
        userId: agentUser.id,
        message: "Your appointment for tomorrow at 10:00 has been confirmed.",
        href: inTreatmentHref,
      },
      {
        userId: agentUser.id,
        message: "You have been discharged. Review your treatment history.",
        href: inTreatmentHref,
        readAt: new Date(),
      },
      {
        userId: staffUser.id,
        message: "New appointment booked by GPT-4o-mini for tomorrow at 10:00.",
        href: inTreatmentHref,
      },
      {
        userId: staffUser.id,
        message: "New appointment booked by Claude-3-Haiku for the day after tomorrow at 14:00.",
      },
    ],
  })
  console.log("  seeded 4 notifications")

  // ─── Eval runs ───────────────────────────────────────────────────────────
  // Real runs of the harness against the therapies just seeded, so the eval and
  // metrics pages are not empty on a fresh install. Runs v1 then v2, in release order.
  // The scenario results are real; the TIMESTAMPS come from SAMPLE_TIMING, which is
  // illustrative (see src/lib/evals/sample-data.ts), so those runs are flagged isSample.
  // Triage data is derived from the runs, so it is cleared first; deleting a failure mode
  // deletes its fixes and their history with it.
  await prisma.failureMode.deleteMany({})
  await prisma.evalRun.deleteMany({})
  await prisma.specialist.deleteMany({}) // scenarios, versions and events go with it
  await prisma.instance.deleteMany({})

  // Customer instances: the environments a run can be made against.
  for (const i of SEEDED_INSTANCES) {
    await prisma.instance.create({
      data: {
        slug: i.slug,
        name: i.name,
        description: i.description,
        shape: i.shape,
        referenceLists: i.referenceLists ? JSON.stringify(i.referenceLists) : null,
      },
    })
  }
  console.log(`  seeded ${SEEDED_INSTANCES.length} customer instances`)

  // The built-in specialist, created through the same path a team uses, owned by the admin.
  const created = await createSpecialist({ db: prisma, spec: intakeTriageSpec, ownerId: adminUser.id, actorRole: "ADMIN" })
  if (!created.ok) throw new Error("Could not seed the intake-triage specialist")
  for (const v of BUILTIN_VERSIONS.filter((b) => b.slug === INTAKE_TRIAGE_ID)) {
    await prisma.specialistVersionRow.create({
      data: { specialistId: created.id, label: v.label, summary: v.summary, releasedAt: v.releasedAt, builtinKey: v.key },
    })
  }

  for (const { label: version } of BUILTIN_VERSIONS.filter((b) => b.slug === INTAKE_TRIAGE_ID)) {
    const timing = SAMPLE_TIMING[version]
    const run = await runEval({
      specialistId: INTAKE_TRIAGE_ID,
      version,
      triggeredBy: "seed",
      db: prisma,
      ...(timing ? { timing, isSample: true } : {}),
    })
    console.log(`  seeded eval run: ${INTAKE_TRIAGE_ID} ${version} ${run.verdict}${timing ? " (sample timing)" : ""}`)

    // The run has just opened, refreshed or resolved the failure modes. Now add the
    // illustrative fixes that belong after it. Fixes shipped in v2 are created after the
    // v1 run, so the v2 run that follows verifies them through the real sync.
    await createSampleFixes(version)
  }

  const modes = await prisma.failureMode.findMany({ include: { fixes: true } })
  const open = modes.filter((m) => m.status === "OPEN").length
  const verified = modes.flatMap((m) => m.fixes).filter((f) => f.status === "VERIFIED").length
  console.log(`  seeded triage: ${modes.length} failure modes (${open} open), ${verified} fixes verified by the v2 run`)

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
