# Phase 7 — Eval Harness & Quality Verdicts: Validation

## Commands that must pass
- [ ] `npx prisma migrate status` reports the database up to date; `npx prisma generate` succeeds (R3)
- [ ] `npm test`: all tests pass, none skipped (existing 85 plus new specialist, checks, verdict, runner, judge, CLI-argument, and guard tests) (R1–R6, R8)
- [ ] `npx tsc --noEmit`: no errors
- [ ] `npm run lint`: no errors or warnings
- [ ] `npm run build`: succeeds; first-load JS for the new routes noted and under 250 kB; the Anthropic SDK does not appear in any client bundle (R9)
- [ ] `npx prisma db seed` on a fresh database completes and creates exactly one `v1` run and one `v2` run (R7)
- [ ] `npm run eval -- --version v1` prints a `FAIL` verdict with failed scenarios and exits non-zero; `npm run eval -- --version v2` prints `PASS` and exits zero (R4, R6, R7)
- [ ] Running the CLI with no `ANTHROPIC_API_KEY` set works and reports the judge as disabled (R5)

## Manual flows

### Staff
- [ ] Open the Evals page from the sidebar: the seeded `v1` and `v2` runs are listed with verdict, dev rate, and hold-out rate (R7)
- [ ] Open the `v1` run: verdict reads FAIL with a stated reason; failures are grouped by category; each failed scenario shows expected versus actual and a reason (R4, R6)
- [ ] Open the `v2` run: verdict reads PASS; the comparison with `v1` shows a positive delta, scenarios fixed, and any regressions (R6)
- [ ] Start a new `v2` run from the page: a new row appears and the page opens its verdict (R3, R7)
- [ ] Without an API key the "Use LLM judge" option is not offered (R5)
- [ ] Delete or rename a therapy in the catalogue, run `v2` again: scenarios that depended on it fail with the "not in catalogue" reason, and the run does not crash (R4)
- [ ] An unknown run id shows a not-found page (R6)

### Admin
- [ ] Same access and abilities as staff; admin users page still works (R8)

### Agent
- [ ] The Evals link is not shown; visiting `/dashboard/evals` and `/dashboard/evals/<id>` directly redirects away; invoking `runEvalAction` directly is rejected and creates no run (R8)

### Optional, with a key
- [ ] With `ANTHROPIC_API_KEY` set, a run with the judge enabled records judge scores for scenarios that passed the checks; unplugging the network mid-run does not fail the run (R5)

## Responsive checks (375, 768, 1280 px, no horizontal scroll) (R9)
- [ ] Evals list page, including the empty state and the run form
- [ ] Verdict page with a long failure list and the comparison section
- [ ] Loading skeletons for both routes
- [ ] Sidebar with the new link at 375 px

## Accessibility (R9)
- [ ] axe reports 0 WCAG 2.1 A and AA violations on the Evals list and a `v1` and a `v2` verdict page, for staff and admin
- [ ] The verdict is conveyed by the words PASS and FAIL, not by colour alone
- [ ] The run form has visible labels and a visible focus ring; the whole flow works from the keyboard
- [ ] Heading order stays h1, h2, h3

## Quality of the eval itself
- [ ] `v1` yields a FAIL and `v2` a PASS on the shipped scenarios, locked by a test so a future edit to either side is noticed
- [ ] Verdict thresholds are named constants with tests at the boundary
- [ ] Every scenario has a unique id, a split, and a one-line reason for its expected answer
- [ ] The overfit case (high dev rate, low hold-out rate) produces a FAIL with the gap reason

## Traceability
| Requirement | Plan groups | Checks |
|---|---|---|
| R1 | 2 | specialist tests, CLI |
| R2 | 2 | scenario tests (counts, ids, catalogue names) |
| R3 | 1, 4 | runner tests, migration status, seed |
| R4 | 3, 4 | checks tests, staff flows (v1 failures, missing therapy) |
| R5 | 5 | judge tests, optional keyed flow, CLI without key |
| R6 | 3, 8 | verdict tests, staff flows, regression test pinning v1/v2 |
| R7 | 6, 8 | seed, CLI, staff flows |
| R8 | 7 | guard tests, agent flow |
| R9 | 8, 9 | lint, tsc, build, axe, responsive |

## Merge checklist
- [ ] All commands above pass on the branch `phase-7-eval-harness`
- [ ] New migration committed; earlier migrations untouched; `prisma/dev.db` and `.env*` not committed
- [ ] Staff, admin, and agent flows walked through by hand
- [ ] Responsive and axe checks done and the audit script committed under `scripts/`
- [ ] `README.md`, `specs/strategy.md`, `specs/follow-ups.md`, and the local changelog updated; Phase 7 marked `✓ Complete` in `specs/roadmap.md`
