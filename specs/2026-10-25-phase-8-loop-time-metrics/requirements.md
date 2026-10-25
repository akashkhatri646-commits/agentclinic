# Phase 8 — Loop-Time & Quality Metrics: Requirements

## Scope

### In
- **R1 Timestamps on every run**: each `EvalRun` records when the change shipped, when the run started, and when the verdict was produced. A change's ship time comes from a `releasedAt` on each specialist version and is copied onto the run when it is made. Existing Phase 7 runs are backfilled so nothing breaks.
- **R2 Loop time**: change shipped to verdict produced, measured once per specialist version (its first verdict). The headline is the median across versions, shown against a target and a baseline. A per-version stage split (waiting for a run versus running) is shown in the table.
- **R3 Quality per version**: dev and hold-out pass rate for each version, taken from that version's latest run.
- **R4 Scenarios fixed and regressions detected**: derived from the version-to-version comparison that already exists (scenarios that newly pass, scenarios that newly fail), per version and in total.
- **R5 Hill-climbing chart**: a server-rendered chart of dev and hold-out pass rate across versions in release order, with the pass threshold marked, and a data table as its text alternative.
- **R6 Seeded sample history**: the seed records one `v1` and one `v2` run through the real harness with illustrative, backdated timestamps (`v1`: 21 days from release to verdict; `v2`: 2 days) and marks them as sample data. Real runs are never flagged.
- **R7 Surfaces**: a Metrics page, a "median loop time" tile on the staff dashboard, a sidebar link, and a visible sample-data notice wherever sample runs appear.
- **R8 Access and resilience**: staff and admin only, using the existing eval guard. A failure while computing the dashboard tile must not break the dashboard.
- **R9 Quality, responsive, accessible**: Vitest coverage for every metric calculation; lint, type check and build clean; axe clean; no horizontal scroll or clipped header at 375 / 768 / 1280 px.

### Out
- A "Change" record or form for staff to log changes (the version release date is the source for now).
- Per-category failure trends, failure clustering, a fix backlog or fix lifecycle (Phase 9).
- Teams-running-unassisted and other adoption metrics (Phase 10).
- A loop-time bar chart or time-axis trend line (the table carries loop time; a second chart is a possible later addition).
- Editing or deleting runs, scheduled runs, alerting on a missed target, exporting data.

## Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Metrics included | All four roadmap metrics, derived from version comparisons | Delivers the whole roadmap bullet using data that already exists; Phase 9 can later replace "scenarios fixed" with tracked fixes |
| Metric names | "Scenarios fixed" and "Regressions detected" in the UI | The data shows a scenario newly passing or failing between versions. It cannot show whether a regression was caught before release, so the roadmap's "fixes shipped" and "regressions caught" would overstate it |
| Placement | New Metrics page plus a tile on the staff dashboard | Full view plus the north-star number visible at login |
| What a loop is | Release to the **first** verdict of each version; headline is the median across versions | Re-running an old version later is not a new loop and must not inflate the number |
| Where "change shipped" comes from | A `releasedAt` on each specialist version in the registry, copied onto the run as `changeShippedAt` when the run is made | No new UI or model; deterministic. Copying it onto the run makes the three timestamps a property of the run, and lets seeded sample runs carry their own backdated dates without altering the code's real release dates |
| Real release dates | `v1` and `v2` are both dated 2026-10-25 (the day they were written) | Honest: it is when they were built. Any illustrative timing lives only in flagged sample runs |
| Run timestamps | Add `startedAt` and `finishedAt` to `EvalRun`; keep `createdAt` | Names the "run started" and "verdict produced" moments as the roadmap does. `finishedAt` is set after the judge (if any) finishes, so it is the real verdict time |
| Existing runs | Backfill `startedAt` and `finishedAt` from `createdAt`; leave `changeShippedAt` empty | The release time of an old run is unknown and must not be invented. Runs without it are left out of loop time and counted in a visible "n runs excluded" note |
| Quality source | The latest run of each version | Reflects the current state of that version (for example after a catalogue change), while loop time uses the first run |
| Chart | Server-rendered inline SVG with a data table beneath | No new dependency or client JavaScript (tech stack rule); the table gives screen-reader access. X axis is the versions in release order (equal spacing), not a calendar axis, so a re-run cannot reorder the story |
| Chart encoding | Dev as a solid line with circle markers, hold-out as a dashed line with square markers, threshold as a labelled reference line | Distinguishable without colour. Follow the repo's `dataviz` guidance when building it |
| Seed data | Illustrative history through the real harness, marked `isSample` | The numbers (pass rates, failures, comparison) are real; only the timestamps are illustrative. A visible notice says so, so invented timings are never presented as measured |
| Sample run dates | When a run is given explicit timing, its `createdAt` is set to the same finish time | Keeps the runs list order and the "previous version" comparison (which uses `createdAt`) consistent |
| Target and baseline | Target is a named constant of 3 days that cites `specs/strategy.md`; baseline is the earliest version's loop time | Gives the headline a frame of reference ("weeks to days"). The strategy doc calls the target a placeholder to be calibrated, so it stays easy to change |
| Dashboard tile | Median loop time against the target, plus the latest version's loop time as a sub-line, linking to the Metrics page | With two seeded versions the median (11.5 days) alone would hide that the latest loop took 2.0 days. The status is written as text ("within target" / "above target"), not colour alone |
| Access | Staff and admin, via the existing eval guard | One rule for the whole feature; agents see nothing about evals or metrics |
| Failure handling | The dashboard tile's data load is fail-soft | A metrics problem must not take the staff dashboard down (the same lesson as the nav unread count in Phase 6) |

## Metric definitions

All durations are computed from the run's own timestamps. Unless stated, an "included" run is one with a `changeShippedAt`.

- **Loop time (per version)**: `finishedAt - changeShippedAt` of that version's earliest included run (earliest by `finishedAt`).
- **Waiting time**: `startedAt - changeShippedAt`. **Running time**: `finishedAt - startedAt`. Both from the same run as loop time.
- **Median loop time**: the median of the per-version loop times; for an even count, the mean of the two middle values; no value when there are no versions.
- **Baseline**: the loop time of the earliest-released version. **Latest**: the loop time of the most recently released version.
- **Target**: `LOOP_TIME_TARGET_MS` = 3 days. "Within target" means the median is below the target.
- **Pass rate (per version)**: dev and hold-out rates of that version's latest run.
- **Scenarios fixed / regressions detected (per version)**: compare that version's latest run with the previous version's latest run, by scenario id (the existing `compareRuns`). The first version has none.
- **Totals**: sums over versions.

## Context

- **Users affected**: staff and admin. Agents are unaffected.
- **Dependencies**: the eval harness, runner, queries, `compareRuns` and verdict code (Phase 7), the registry of specialist versions, `canViewEvals`, the sidebar and staff dashboard, the `EmptyState` and `loading.tsx` patterns, and the committed audit script.
- **Constraints** (from `specs/tech-stack.md`): Prisma only, no raw SQL in app code (the migration backfill is SQL inside a migration file, which is normal); server components and no client data-fetching library; PicoCSS with overrides in `globals.css`; strict TypeScript; `prisma/dev.db` not committed; responsive at 375 / 768 / 1280 px with no horizontal scroll and no clipped header.
- **Mission fit**: this phase makes the strategy's north-star ("change to clear verdict") measurable and gives the "weeks to days" claim a visible baseline.
- **Risks**:
  - Illustrative timings could be mistaken for measurements. Mitigated by the `isSample` flag, a visible notice on every page that includes sample runs, and a validation check that real runs are never flagged.
  - With only two versions, medians and "trends" rest on very little data. The page says how many versions each number is based on.
  - Time zones: store UTC, display in a fixed, stated format so the same run reads the same for everyone.
  - Clock changes or a release date after the verdict would give a negative duration. Clamp to zero and note it rather than showing a negative.
  - The chart is the first custom SVG in the app; verify it at 375 px and with a screen reader label.
- **Open questions for later phases**: whether releases become a logged "Change" record with a form (Phase 10), and how fix tracking replaces "scenarios fixed" (Phase 9).
