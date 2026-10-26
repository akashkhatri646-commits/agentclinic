import { PrismaClient } from "@prisma/client"
import { ensureBuiltins } from "../src/lib/evals/builtin-setup"

// Brings an existing database up to date after `prisma migrate deploy`, keeping its runs and history.
// Safe to run again. See the README ("After pulling a new version").
const prisma = new PrismaClient()

ensureBuiltins(prisma)
  .then(async (r) => {
    console.log(
      `Upgrade complete: ${r.instancesCreated} instances added, built-in specialist ${r.specialist}, ${r.versionsCreated} versions added.`
    )
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e)
    await prisma.$disconnect()
    process.exit(1)
  })
