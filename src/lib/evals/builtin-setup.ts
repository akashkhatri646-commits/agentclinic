import type { PrismaClient } from "@prisma/client"
import { BUILTIN_VERSIONS } from "./builtin"
import { intakeTriageSpec } from "./builtin-spec"
import { SEEDED_INSTANCES } from "./instances"
import { createSpecialist } from "./specialist-store"

/**
 * Brings a database that already holds eval runs from before Phase 10 up to date, without touching
 * them. The migration creates the tables; this adds the rows the app now needs in them: the customer
 * instances, the built-in intake-triage specialist, and its code-defined versions. Everything it does is
 * "add if missing", so it is safe to run again, and it never deletes or rewrites existing runs. (The
 * seed does the same and then resets the demo data, which is not what an existing database wants.)
 */
export type SetupDb = Pick<PrismaClient, "instance" | "specialist" | "specialistVersionRow" | "specialistEvent" | "evalRun" | "user">

export type SetupResult = {
  instancesCreated: number
  specialist: "created" | "present"
  versionsCreated: number
}

export async function ensureBuiltins(db: SetupDb): Promise<SetupResult> {
  let instancesCreated = 0
  for (const i of SEEDED_INSTANCES) {
    if (await db.instance.findUnique({ where: { slug: i.slug }, select: { id: true } })) continue
    await db.instance.create({
      data: {
        slug: i.slug,
        name: i.name,
        description: i.description,
        shape: i.shape,
        referenceLists: i.referenceLists ? JSON.stringify(i.referenceLists) : null,
      },
    })
    instancesCreated++
  }

  const slug = intakeTriageSpec.slug
  let row = await db.specialist.findUnique({ where: { slug }, select: { id: true } })
  let specialist: SetupResult["specialist"] = "present"
  if (!row) {
    // Owned by the first admin (or, failing that, the first user); dated from its earliest run, if any.
    const owner =
      (await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, role: true } })) ??
      (await db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, role: true } }))
    if (!owner) throw new Error("There are no users to own the built-in specialist. Run the database seed first.")
    const earliest = await db.evalRun.findFirst({ where: { specialistId: slug }, orderBy: { createdAt: "asc" }, select: { createdAt: true } })
    const created = await createSpecialist({
      db,
      spec: intakeTriageSpec,
      ownerId: owner.id,
      actorRole: owner.role,
      ...(earliest ? { createdAt: earliest.createdAt } : {}),
    })
    if (!created.ok) throw new Error("Could not create the built-in specialist")
    row = { id: created.id }
    specialist = "created"
  }

  let versionsCreated = 0
  for (const v of BUILTIN_VERSIONS.filter((b) => b.slug === slug)) {
    const exists = await db.specialistVersionRow.findFirst({ where: { specialistId: row.id, label: v.label }, select: { id: true } })
    if (exists) continue
    await db.specialistVersionRow.create({
      data: { specialistId: row.id, label: v.label, summary: v.summary, releasedAt: v.releasedAt, builtinKey: v.key },
    })
    versionsCreated++
  }
  return { instancesCreated, specialist, versionsCreated }
}
