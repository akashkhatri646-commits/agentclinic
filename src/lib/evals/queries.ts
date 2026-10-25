import type { EvalRun } from "@prisma/client"
import { prisma } from "../prisma"
import { getPreviousVersion } from "./specialists"

export async function getEvalRuns(specialistId?: string) {
  return prisma.evalRun.findMany({
    where: specialistId ? { specialistId } : undefined,
    orderBy: { createdAt: "desc" },
  })
}

/** A run with its results, DEV before HOLDOUT and then by scenario id. */
export async function getEvalRunById(id: string) {
  return prisma.evalRun.findUnique({
    where: { id },
    include: { results: { orderBy: [{ split: "asc" }, { scenarioId: "asc" }] } },
  })
}

/** Every run of a specialist with just the per-scenario outcome the metrics need. */
export async function getRunsForMetrics(specialistId: string) {
  return prisma.evalRun.findMany({
    where: { specialistId },
    orderBy: { createdAt: "asc" },
    include: { results: { select: { scenarioId: true, passed: true } } },
  })
}

export async function getLatestRunForVersion(specialistId: string, version: string) {
  return prisma.evalRun.findFirst({
    where: { specialistId, version },
    orderBy: { createdAt: "desc" },
    include: { results: true },
  })
}

/**
 * The most recent run of the version released before `run`'s version, taken at
 * or before `run` was created so old runs compare against what existed then.
 * Returns null for the first version, or when that version has never been run.
 */
export async function getPreviousVersionRun(run: Pick<EvalRun, "specialistId" | "version" | "createdAt">) {
  const previous = getPreviousVersion(run.specialistId, run.version)
  if (!previous) return null
  return prisma.evalRun.findFirst({
    where: {
      specialistId: run.specialistId,
      version: previous.version,
      createdAt: { lte: run.createdAt },
    },
    orderBy: { createdAt: "desc" },
    include: { results: true },
  })
}
