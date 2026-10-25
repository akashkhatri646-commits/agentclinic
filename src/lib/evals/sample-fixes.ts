import type { ThemeId } from "./themes"

/**
 * ILLUSTRATIVE fixes used by the seed so a fresh install shows the whole fix
 * lifecycle. The titles, owners and dates are INVENTED, not real work. They are
 * stored with isSample = true and the pages say so. What is real: the failure
 * modes and their scores (derived from the real v1 and v2 runs), and the
 * verification of the fixes that shipped in v2, which is done by the real sync
 * when the v2 run completes.
 *
 * Dates sit on the same invented timeline as SAMPLE_TIMING in sample-data.ts:
 * v1's verdict arrives 22 Sep, v2 ships 20 Oct and its verdict arrives 22 Oct.
 */
export type SampleFix = {
  /** The failure mode this fix targets. */
  theme: ThemeId
  title: string
  description: string
  ownerEmail: string
  /** Created after this version's run completes (so the failure mode exists). */
  afterRun: "v1" | "v2"
  createdAt: Date
  /** When work started. Leave out to keep the fix proposed. */
  startedAt?: Date
  /** When it shipped, and in which version. Both or neither. */
  shippedAt?: Date
  shippedVersion?: string
}

const d = (iso: string) => new Date(iso)

export const SAMPLE_FIXES: SampleFix[] = [
  // Shipped in v2. The v2 run passes all of these themes, so the sync verifies them.
  {
    theme: "expectation-gap",
    title: "Add human-expectation rules",
    description: "Recognise words like expect, demand, want and 'gap between' and recommend Human Expectation Recalibration.",
    ownerEmail: "staff@clinic.local",
    afterRun: "v1",
    createdAt: d("2026-09-23T10:00:00Z"),
    startedAt: d("2026-09-25T09:00:00Z"),
    shippedAt: d("2026-10-20T09:00:00Z"),
    shippedVersion: "v2",
  },
  {
    theme: "fabrication-vocabulary",
    title: "Widen the fabrication vocabulary",
    description: "Treat 'fabricate', 'making things up', 'invented' and 'as facts' as signs of hallucination, not just the word itself.",
    ownerEmail: "staff@clinic.local",
    afterRun: "v1",
    createdAt: d("2026-09-23T10:05:00Z"),
    startedAt: d("2026-09-25T09:30:00Z"),
    shippedAt: d("2026-10-20T09:00:00Z"),
    shippedVersion: "v2",
  },
  {
    theme: "persistent-wording",
    title: "Recognise persistent, chronic and relentless wording",
    description: "Add the words that signal ongoing, high-severity distress.",
    ownerEmail: "admin@clinic.local",
    afterRun: "v1",
    createdAt: d("2026-09-23T10:10:00Z"),
    startedAt: d("2026-09-26T09:00:00Z"),
    shippedAt: d("2026-10-20T09:00:00Z"),
    shippedVersion: "v2",
  },
  {
    theme: "negation",
    title: "Ignore negated severity words",
    description: "A severity word preceded by 'not' or 'no' should not raise the severity.",
    ownerEmail: "admin@clinic.local",
    afterRun: "v1",
    createdAt: d("2026-09-23T10:15:00Z"),
    startedAt: d("2026-09-26T09:30:00Z"),
    shippedAt: d("2026-10-20T09:00:00Z"),
    shippedVersion: "v2",
  },
  // Shipped in v2 but not proven: the sarcasm scenarios still fail, so it stays "shipped, not yet verified".
  {
    theme: "sarcasm-and-idiom",
    title: "Read sarcasm and common idioms",
    description: "A first pass at idiomatic phrases. It handles some wording but not all of it.",
    ownerEmail: "staff@clinic.local",
    afterRun: "v1",
    createdAt: d("2026-09-23T10:20:00Z"),
    startedAt: d("2026-09-27T09:00:00Z"),
    shippedAt: d("2026-10-20T09:00:00Z"),
    shippedVersion: "v2",
  },
  // Created after the v2 run, for the failure modes that are still open.
  {
    theme: "sarcasm-and-idiom",
    title: "Add a list of 'far from' and similar idioms",
    description: "Cover the regression where 'far from a crisis' is read as a crisis.",
    ownerEmail: "admin@clinic.local",
    afterRun: "v2",
    createdAt: d("2026-10-23T09:00:00Z"),
  },
  {
    theme: "frequency-vs-intensity",
    title: "Separate frequency words from intensity words",
    description: "Stop 'constant' from meaning severe when it describes how often something happens.",
    ownerEmail: "staff@clinic.local",
    afterRun: "v2",
    createdAt: d("2026-10-23T09:10:00Z"),
    startedAt: d("2026-10-24T09:00:00Z"),
  },
]
