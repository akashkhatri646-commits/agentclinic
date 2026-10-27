# Phase 8 — Loop-Time & Quality Metrics: Plan

Each group leaves the app working. Tests sit with the code they cover. Requirement ids (R1–R9) refer to `requirements.md`.

## Task Groups

### 1. Schema, migration and release dates (R1)
Goal: the data the metrics need exists, and old data still works.
- [ ] 1.1 Add to `EvalRun` in `prisma/schema.prisma`: `changeShippedAt DateTime?`, `startedAt DateTime?`, `finishedAt DateTime?`, `isSample Boolean @default(false)`
- [ ] 1.2 Create the migration with `--create-only`, then edit the SQL to backfill existing rows: `UPDATE "EvalRun" SET "startedAt" = "createdAt", "finishedAt" = "createdAt"`; leave `changeShippedAt` empty. Apply it, run `npx prisma generate`, and revert any cosmetic rewrite of `migration_lock.toml`
- [ ] 1.3 Add `releasedAt: Date` to `SpecialistVersion` in `src/lib/evals/types.ts` and set it for `v1` and `v2` (both 2026-10-25, with a comment that they were written that day)
- [ ] 1.4 Tests: every registered version has a valid `releasedAt`, and releases are in non-decreasing order matching registry order

### 2. Runner records the three timestamps (R1)
Goal: every new run carries change-shipped, started and verdict times.
- [ ] 2.1 In `src/lib/evals/runner.ts`, record `startedAt` before the first scenario and `finishedAt` after the verdict (after any judge calls); set `changeShippedAt` from the version's `releasedAt`
- [ ] 2.2 Add optional `timing` (`changeShippedAt`, `startedAt`, `finishedAt`) and `isSample` options, used by the seed. When `finishedAt` is supplied, set `createdAt` to the same value so list order and previous-version lookup stay consistent
- [ ] 2.3 Validate supplied timing: reject `startedAt` before `changeShippedAt` or `finishedAt` before `startedAt` with a clear error
- [ ] 2.4 Update `src/tests/evals-runner.test.ts`: timestamps are set and ordered; `changeShippedAt` equals the version's release date; overrides are stored; `createdAt` follows `finishedAt` when timing is supplied; invalid ordering is rejected; `isSample` defaults to false

### 3. Metric calculations (R2, R3, R4)
Goal: pure, well-tested functions. No UI yet.
- [ ] 3.1 Create `src/lib/evals/metrics.ts` with `LOOP_TIME_TARGET_MS` (3 days, with a comment citing `specs/strategy.md`)
- [ ] 3.2 Add `median`, `formatDuration` (minutes under an hour, hours under two days, otherwise days to one decimal) and `loopTimes(run)` returning loop, waiting and running durations, clamped at zero
- [ ] 3.3 Add `buildMetrics(runs, versions)` returning per-version rows (release date, loop, waiting, running, dev rate, hold-out rate, scenarios fixed, regressions detected, whether it is sample), plus median, baseline, latest, within-target, totals, number of runs excluded for lack of a release time, and whether any included run is sample
- [ ] 3.4 Tests in `src/tests/evals-metrics.test.ts`: median with odd, even, single and empty lists; first run per version is used for loop time and re-runs do not change it; latest run is used for pass rates; runs without `changeShippedAt` are excluded and counted; fixed and regressed come from the comparison and the first version has none; target boundary (just under, exactly, just over); negative durations clamp to zero; formatting at each unit boundary; a hand-computed fixture matching the seeded story (21.0 days, 2.0 days, median 11.5 days)

### 4. Queries and seed (R6)
Goal: a fresh install has a meaningful, honestly labelled history.
- [ ] 4.1 Add `getRunsForMetrics()` to `src/lib/evals/queries.ts` returning all runs of the specialist with their results
- [ ] 4.2 Extend `prisma/seed.ts`: run `v1` then `v2` through the real runner with explicit illustrative timing and `isSample: true` (`v1` shipped 2026-09-01 09:00 UTC, verdict 2026-09-22 09:05 UTC; `v2` shipped 2026-10-20 09:00 UTC, run 2026-10-22 09:00 UTC, verdict 2026-10-22 09:04 UTC). Clear earlier eval rows first so the seed stays idempotent
- [ ] 4.3 Tests: the sample timeline is ordered and produces 21.0 and 2.0 days; the seed constants are marked as illustrative in code comments
- [ ] 4.4 Run `npx prisma db seed` and confirm two sample runs exist

### 5. Hill-climbing chart (R5)
Goal: an accessible chart with no new dependency.
- [ ] 5.1 Read the repo's `dataviz` guidance before writing any chart code
- [ ] 5.2 Create `src/lib/evals/chart.ts`: a pure function turning version rows into point coordinates, axis ticks and threshold position for a given width and height (so geometry is testable)
- [ ] 5.3 Create `src/components/PassRateChart.tsx`: server-rendered SVG with dev (solid, circles) and hold-out (dashed, squares) lines, y axis 0 to 100%, a labelled 85% threshold line, version labels, `role="img"` with a summary label, and responsive scaling via `viewBox`
- [ ] 5.4 Handle one version (points without lines) and no data (an empty state, no chart)
- [ ] 5.5 Tests for the geometry function: scaling, ordering, clamping, a single point, empty input

### 6. Metrics page and navigation (R7, R8)
Goal: staff can read the metrics.
- [ ] 6.1 `src/app/dashboard/metrics/page.tsx`: role guard with `canViewEvals`; headline tiles (median loop time against target with a text status, baseline, latest, scenarios fixed, regressions detected, each stating how many versions it covers); the chart; the per-version table; a sample-data notice when any included run is sample; a note when runs were excluded; `EmptyState` with no runs
- [ ] 6.2 `loading.tsx` skeleton
- [ ] 6.3 Add a "Metrics" link to the sidebar for staff and admin
- [ ] 6.4 Mark sample runs on the Evals list ("sample") and add a sample notice on a sample run's verdict page
- [ ] 6.5 Check 375 / 768 / 1280 px, including the chart and a wide table inside the scrolling wrapper

### 7. Dashboard tile (R7, R8)
Goal: the north-star number visible at login.
- [ ] 7.1 Add a tile to the staff dashboard showing the median loop time, the target and a "within target" or "above target" text status, the latest version's loop time as a sub-line, and a link to the Metrics page
- [ ] 7.2 Load its data through a fail-soft helper that returns nothing and logs on error, so the dashboard still renders
- [ ] 7.3 Tests for the fail-soft helper (success, thrown error, no runs)

### 8. Quality pass and docs (R9)
Goal: ready to merge.
- [ ] 8.1 `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` all clean; note first-load JS for the new routes (no chart library, so it should stay near the others)
- [ ] 8.2 Extend `scripts/audit.js` with `/dashboard/metrics` for staff and admin and add it to the agent's forbidden pages; run it at 375 / 768 / 1280 px and resolve all violations
- [x] 8.3 Walk the manual flows in `validation.md` in a browser, not only over HTTP
- [ ] 8.4 Verify with a screen reader or the accessibility tree that the chart has a meaningful label and the table is reachable
- [ ] 8.5 Update `README.md`, `specs/strategy.md` status, `specs/follow-ups.md`, and the local changelog
- [ ] 8.6 Mark Phase 8 `✓ Complete` in `specs/roadmap.md` when merged
