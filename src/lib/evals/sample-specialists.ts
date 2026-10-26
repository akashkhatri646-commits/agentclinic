import type { OutputValues } from "./grade"
import type { SpecialistSpec } from "./spec"

/**
 * ILLUSTRATIVE specialists used by the seed so a fresh install shows an adoption story: one
 * team that ran the loop on its own, one that needed an admin's help, and one still part-way.
 * The names, owners, dates and who-helped-whom are INVENTED, not real work. Each is stored
 * with isSample = true and the pages say so. What is real: they are created, imported, graded,
 * triaged and verified through the same code a team uses, so their scenario results, failure
 * modes and verified fixes are what the harness actually produces for these outputs.
 *
 * The story (all dates on the same invented timeline as sample-data.ts and sample-fixes.ts):
 *   ticket-router    owned by staff, first verdict 2 days after creation, onboarded alone
 *   refund-triage    owned by staff, first verdict 9 days in, an admin helped, onboarded
 *   intent-detector  owned by staff, first verdict 2 days in, fix still in progress
 */
export type SampleVersion = {
  label: string
  summary: string
  releasedAt: Date
  startedAt: Date
  finishedAt: Date
  /** The scenarios this version answers wrongly (it answers the other category). */
  wrong: string[]
  /** Who imported it: the owner, or the admin (which makes the specialist "assisted"). */
  importedBy: "owner" | "admin"
}

export type SampleFixStep = {
  title: string
  description: string
  theme: string
  createdAt: Date
  startedAt: Date
  /** Present when the fix ships; the version must be one of this specialist's. */
  shipped?: { version: string; at: Date }
  /** Created after this version's run (so the failure mode exists). */
  afterVersion: string
  /** Who moves the fix: the owner, or the admin. */
  actor: "owner" | "admin"
}

export type SampleSpecialist = {
  slug: string
  name: string
  description: string
  ownerEmail: string
  createdAt: Date
  versions: SampleVersion[]
  fixes: SampleFixStep[]
}

const d = (iso: string) => new Date(iso)

export const SAMPLE_SPECIALISTS: SampleSpecialist[] = [
  {
    slug: "ticket-router",
    name: "Support ticket router",
    description: "Routes a support ticket to billing or shipping.",
    ownerEmail: "staff@clinic.local",
    createdAt: d("2026-10-05T09:00:00Z"),
    versions: [
      {
        label: "v1",
        summary: "First draft: keyword routing.",
        releasedAt: d("2026-10-05T15:00:00Z"),
        startedAt: d("2026-10-07T08:55:00Z"),
        finishedAt: d("2026-10-07T09:00:00Z"),
        wrong: ["d05", "d06", "d07"],
        importedBy: "owner",
      },
      {
        label: "v2",
        summary: "Reads refund and damage wording.",
        releasedAt: d("2026-10-09T10:00:00Z"),
        startedAt: d("2026-10-10T08:55:00Z"),
        finishedAt: d("2026-10-10T09:00:00Z"),
        wrong: [],
        importedBy: "owner",
      },
    ],
    fixes: [
      {
        title: "Read refund and damage wording",
        description: "Treat refund requests as billing and damage reports as shipping, even when both words appear.",
        theme: "edge-cases",
        createdAt: d("2026-10-07T10:00:00Z"),
        startedAt: d("2026-10-07T14:00:00Z"),
        shipped: { version: "v2", at: d("2026-10-09T10:00:00Z") },
        afterVersion: "v1",
        actor: "owner",
      },
    ],
  },
  {
    slug: "refund-triage",
    name: "Refund triage",
    description: "Decides whether a request is a billing or a shipping matter.",
    ownerEmail: "staff@clinic.local",
    createdAt: d("2026-09-15T09:00:00Z"),
    versions: [
      {
        label: "v1",
        summary: "Baseline rules.",
        releasedAt: d("2026-09-16T09:00:00Z"),
        startedAt: d("2026-09-24T08:55:00Z"),
        finishedAt: d("2026-09-24T09:00:00Z"),
        wrong: ["d05", "d06", "d07", "h03"],
        importedBy: "admin",
      },
      {
        label: "v2",
        summary: "Handles late-delivery refunds.",
        releasedAt: d("2026-10-01T09:00:00Z"),
        startedAt: d("2026-10-03T08:55:00Z"),
        finishedAt: d("2026-10-03T09:00:00Z"),
        wrong: [],
        importedBy: "owner",
      },
    ],
    fixes: [
      {
        title: "Route late-delivery refunds to billing",
        description: "A refund asked for because a parcel was late is a billing matter.",
        theme: "edge-cases",
        createdAt: d("2026-09-25T10:00:00Z"),
        startedAt: d("2026-09-26T10:00:00Z"),
        shipped: { version: "v2", at: d("2026-10-01T09:00:00Z") },
        afterVersion: "v1",
        actor: "owner",
      },
    ],
  },
  {
    slug: "intent-detector",
    name: "Intent detector",
    description: "Spots whether a message is about billing or shipping.",
    ownerEmail: "staff@clinic.local",
    createdAt: d("2026-10-12T09:00:00Z"),
    versions: [
      {
        label: "v1",
        summary: "First attempt.",
        releasedAt: d("2026-10-12T15:00:00Z"),
        startedAt: d("2026-10-14T08:55:00Z"),
        finishedAt: d("2026-10-14T09:00:00Z"),
        wrong: ["d05", "d06", "d07", "h04"],
        importedBy: "owner",
      },
    ],
    fixes: [
      {
        title: "Handle messages that mention both topics",
        description: "Decide by the main request, not the first keyword.",
        theme: "edge-cases",
        createdAt: d("2026-10-14T10:00:00Z"),
        startedAt: d("2026-10-15T10:00:00Z"),
        afterVersion: "v1",
        actor: "owner",
      },
    ],
  },
]

/** The category a wrong answer gives: the other one. */
const flip = (category: string): string => (category === "billing" ? "shipping" : "billing")

/** The outputs of a sample version for a classification spec: right except where `wrong` says. */
export function sampleOutputs(spec: Pick<SpecialistSpec, "scenarios">, wrong: string[]): Record<string, OutputValues> {
  return Object.fromEntries(
    spec.scenarios.map((s) => [s.id, { category: wrong.includes(s.id) ? flip(s.expected.category) : s.expected.category }])
  )
}
