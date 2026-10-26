import type { EvalRun } from "@prisma/client"
import { prisma } from "../prisma"

/** A specialist's version labels in release order, or an empty list for an unknown specialist. */
export async function getVersionLabels(specialistId: string): Promise<string[]> {
  const row = await prisma.specialist.findUnique({
    where: { slug: specialistId },
    select: { versions: { orderBy: { releasedAt: "asc" }, select: { label: true } } },
  })
  return row ? row.versions.map((v) => v.label) : []
}

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
    include: { results: { select: { scenarioId: true, passed: true, split: true } } },
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
 * The most recent run of the version released before `run`'s version, on the same instance,
 * taken at or before `run` was created so old runs compare against what existed then.
 * Returns null for the first version, or when that version has never been run there.
 */
export async function getPreviousVersionRun(
  run: Pick<EvalRun, "specialistId" | "version" | "createdAt" | "instanceSlug">
) {
  const labels = await getVersionLabels(run.specialistId)
  const index = labels.indexOf(run.version)
  if (index <= 0) return null
  return prisma.evalRun.findFirst({
    where: {
      specialistId: run.specialistId,
      version: labels[index - 1],
      instanceSlug: run.instanceSlug,
      createdAt: { lte: run.createdAt },
    },
    orderBy: { createdAt: "desc" },
    include: { results: true },
  })
}
