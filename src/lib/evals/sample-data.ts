/**
 * ILLUSTRATIVE history used by the seed so a fresh install shows a meaningful
 * loop-time story. These timings are INVENTED, not measured: v1 and v2 were both
 * written on the same day. The scenario results, pass rates and comparison on the
 * seeded runs are real (they come from running the harness); only the times are
 * made up. Every run seeded with these is stored with isSample = true and the UI
 * says so wherever sample runs appear.
 *
 * The story: v1 waited three weeks for its first verdict; v2, after the loop was
 * tightened, took two days.
 */
export type SampleTiming = { changeShippedAt: Date; startedAt: Date; finishedAt: Date }

export const SAMPLE_TIMING: Record<string, SampleTiming> = {
  // 21 days from shipping to a verdict, almost all of it waiting for a run.
  v1: {
    changeShippedAt: new Date("2026-09-01T09:00:00Z"),
    startedAt: new Date("2026-09-22T09:00:00Z"),
    finishedAt: new Date("2026-09-22T09:05:00Z"),
  },
  // 2 days from shipping to a verdict.
  v2: {
    changeShippedAt: new Date("2026-10-20T09:00:00Z"),
    startedAt: new Date("2026-10-22T09:00:00Z"),
    finishedAt: new Date("2026-10-22T09:04:00Z"),
  },
}

/**
 * When the built-in intake-triage specialist is shown as created: the day v1 shipped, on the same
 * invented timeline, so its time to first verdict reads as the 21 days v1 waited. Illustrative.
 */
export const SAMPLE_INTAKE_CREATED_AT = new Date("2026-09-01T09:00:00Z")
