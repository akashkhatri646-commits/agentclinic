# Phase 8 — Loop-Time & Quality Metrics: Validation

## Commands that must pass
- [ ] `npx prisma migrate status` reports the database up to date; `npx prisma generate` succeeds (R1)
- [ ] `npm test`: all tests pass, none skipped (existing 226 plus new runner-timing, metrics, chart-geometry and tile tests) (R1–R5, R8)
- [ ] `npx tsc --noEmit`: no errors
- [ ] `npm run lint`: no errors or warnings
- [ ] `npm run build`: succeeds; first-load JS for the new route noted and under 250 kB; no chart library added to the client bundle (R9)
- [ ] `npx prisma db seed` on a fresh database completes and creates exactly two eval runs, both marked as sample, with the documented timestamps (R6)
- [ ] On the seeded database the metrics read as follows, checked against the Metrics page and against a hand calculation (R2, R3, R4):
  - `v1` loop time 21.0 days; `v2` loop time 2.0 days
  - median loop time 11.5 days; baseline 21.0 days; latest 2.0 days; status "above target" (target 3 days)
  - `v1` dev 50.0% and hold-out 37.5%; `v2` dev 91.7% and hold-out 87.5%
  - scenarios fixed 15 and regressions detected 1 (v1 to v2)
- [ ] A migration applied to a database that already holds Phase 7 runs leaves those runs usable: they keep their data, get `startedAt` and `finishedAt` from `createdAt`, and have no `changeShippedAt` (R1)

## Manual flows

### Staff
- [x] The staff dashboard shows the loop-time tile with the median, the target, a text status, the latest version's loop time and a working link to Metrics (R7)
- [x] The Metrics page shows the headline numbers above, the chart, and a per-version table with release date, waiting, running, loop time, pass rates, fixed and regressed (R2–R5, R7)
- [x] The sample-data notice is visible on the Metrics page and on the sample runs' pages and list rows (R6, R7)
- [x] Run `v2` from the Evals page: the new run is not marked sample, has changed `startedAt` and `finishedAt`, and does not change the loop-time median (a re-run is not a new loop) but does update `v2`'s pass rates if the result differs (R1, R2, R3)
- [x] Remove the sample runs from the database (or start from an empty database), run `v1`: its loop time is computed from the version's real release date (2026-10-25) to the new verdict, the page shows no sample notice, and with one version the chart shows points without a connecting line (R2, R5, R6)
- [x] An empty database shows the empty state, not a broken chart or a division by zero (R5)
- [x] A run with no change-shipped time is left out of loop time and counted in the "excluded" note (R1)

### Admin
- [x] Same access and view as staff (R8)

### Agent
- [x] The Metrics link and the dashboard tile are not shown; visiting `/dashboard/metrics` directly redirects to a normal page with no metrics content (R8)

### Resilience
- [x] Make the metrics query fail (for example by temporarily renaming a column in a scratch database): the staff dashboard still renders, without the tile, and an error is logged (R8)

## Responsive checks (375, 768, 1280 px: no horizontal scroll, header and Sign out visible) (R9)
- [ ] Metrics page: headline tiles stack cleanly, the chart scales without overflow, the table scrolls inside its wrapper
- [ ] Staff dashboard with the new tile
- [ ] Loading skeleton for the Metrics route
- [ ] Sidebar with the new link at 375 px

## Accessibility (R9)
- [ ] axe reports 0 WCAG 2.1 A and AA violations on the Metrics page and the staff dashboard, for staff and admin
- [ ] The chart has `role="img"` and an accessible name that summarises the result; the data table is the text alternative and is reachable by keyboard
- [ ] The chart does not rely on colour alone (line style and marker shape differ; the threshold is labelled); the target status is words, not just a colour
- [ ] Text and line contrast meet WCAG AA in light and dark mode
- [ ] Heading order stays h1, h2, h3

## Quality of the metrics themselves
- [ ] Every calculation has a test at its boundaries: empty, single, odd and even counts, exactly at the target, negative durations clamped, unit boundaries in `formatDuration`
- [ ] A re-run of a version never changes that version's loop time, and does change its pass rates
- [ ] Real runs are never marked sample, and sample runs are always marked (checked on the seeded database and after a UI run)
- [ ] The page states how many versions and runs each number is based on, and any exclusions

## Traceability
| Requirement | Plan groups | Checks |
|---|---|---|
| R1 | 1, 2 | migration test on old data, runner tests, manual flows |
| R2 | 3 | metrics tests, seeded numbers, staff flows |
| R3 | 3 | metrics tests, seeded numbers |
| R4 | 3 | metrics tests, seeded numbers |
| R5 | 5, 6 | geometry tests, chart a11y checks, empty and single-version flows |
| R6 | 4, 6 | seed check, sample notices, real-run-not-sample check |
| R7 | 6, 7 | staff flows, responsive checks |
| R8 | 6, 7 | agent flow, resilience flow, guard reuse |
| R9 | 3, 8 | lint, tsc, build, axe, responsive audit |

## Merge checklist
- [ ] All commands above pass on the branch `phase-8-loop-time-metrics`
- [ ] New migration committed; earlier migrations untouched; `prisma/dev.db` and `.env*` not committed
- [x] Staff, admin and agent flows walked through by hand in a browser
- [ ] Responsive and axe checks done with the committed audit script, which now covers the Metrics page
- [ ] `README.md`, `specs/strategy.md`, `specs/follow-ups.md` and the local changelog updated; Phase 8 marked `✓ Complete` in `specs/roadmap.md`
