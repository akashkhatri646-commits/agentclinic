# Phase 9 — Failure Triage & Prioritized Fixes: Validation

## Commands that must pass
- [ ] `npx prisma migrate status` reports the database up to date; `npx prisma generate` succeeds (R2, R4)
- [ ] The migration applies cleanly to a database that already holds eval runs, results and Phase 8 data, and leaves them intact (R2)
- [ ] `npm test`: all tests pass, none skipped (the existing 313 plus new theme, triage, sync, fix-service, query and guard tests) (R1–R8)
- [ ] `npx tsc --noEmit`: no errors
- [ ] `npm run lint`: no errors or warnings
- [ ] `npm run build`: succeeds; first-load JS for the new routes noted and under 250 kB (R10)
- [ ] `npx prisma db seed` on a fresh database completes and produces exactly the backlog below (R9)
- [ ] The pinned results still hold: `v1` fails 17 scenarios and `v2` fails exactly `d23`, `d24` and `h08`, so tagging themes changed no behaviour (R1)

## What the seeded database must show (R2, R3, R5, R6, R9)
- [ ] Eight failure modes were created from the `v1` run (17 failing scenarios): `expectation-gap` 5, `fabrication-vocabulary` 4, `persistent-wording` 3, and one each for `sarcasm-and-idiom`, `negation`, `softening-words`, `context-carryover` and `frequency-vs-intensity`
- [ ] After the `v2` run, two are open and six are resolved
- [ ] Open, ranked: `sarcasm-and-idiom` (2 of 2 failing, severity 2, effort 2, score 2.0) first, then `frequency-vs-intensity` (1 of 1, severity 2, effort 2, score 1.0)
- [ ] `sarcasm-and-idiom` shows one regressed scenario, `d24`, which passed in `v1`
- [ ] Four fixes were verified by the system through the `v2` run (for `expectation-gap`, `fabrication-vocabulary`, `persistent-wording` and `negation`), each recording the verifying run and its time
- [ ] The `sarcasm-and-idiom` fix that shipped in `v2` is still "shipped" and reads "not yet verified: still failing"; the second `sarcasm-and-idiom` fix is proposed; the `frequency-vs-intensity` fix is in progress
- [ ] `softening-words` and `context-carryover` are resolved with no fix recorded
- [ ] Every seeded fix is marked as sample and the pages say so; the failure modes and scores are real

## Manual flows

### Staff
- [x] The Triage page lists the backlog above, says which version and run it reflects, and shows summary counts that agree with the table (R3, R8)
- [x] Open a failure mode: it shows its score inputs and the formula; changing effort to L lowers its score and the ranking updates; setting a severity override changes the score; clearing the override returns to the suggestion (R3)
- [x] Add a fix to `frequency-vs-intensity` with an owner: it appears as proposed, an event is recorded with the actor, and the owner gets a notification (R4, R7)
- [x] Move that fix to in progress, then try to move it straight to verified: refused. Move it to shipped without choosing a version: refused. Choose `v2`: accepted (R4, R5)
- [x] The shipped fix reads "not yet verified" while the scenarios still fail, and the owner is not told it is verified (R5, R7)
- [x] Reassign a fix to another user: an event is recorded and the new owner is notified; assigning it to yourself sends no notification (R4, R7)
- [x] Run `v2` again: nothing that was verified changes, and the backlog numbers stay the same (R2, R5)
- [x] Run `v1` after `v2`: the failure modes' state does not change, because `v1` is not the latest evaluated version (R2)

### Reappearance (R6, R7)
- [x] Delete an unused therapy that the expectation scenarios depend on (Human Expectation Recalibration) from the Therapies page, then run `v2`
- [x] `expectation-gap` reopens with a "reappeared" flag, its frequency reflects the failing scenarios, and the owner of its verified fix is notified
- [x] Restore the data with a reseed and confirm the backlog returns to the state above

### Admin
- [x] Same access and abilities as staff (R8)

### Agent
- [x] The Triage link is not shown; visiting `/dashboard/triage` and `/dashboard/triage/<id>` directly redirects to a normal page with no triage content; calling each action directly is refused and changes nothing (R8)

### Input handling (R4, R8)
- [x] A fix title that is empty or over 120 characters, an effort outside 1 to 3, an unknown version, and an owner who is an agent are each refused with a visible message
- [x] Text typed into a title or description containing markup is shown as plain text
- [x] A crafted `?error=` value shows no message; a known code shows its fixed message
- [x] An unknown failure mode id shows a not-found page

### Resilience (R2)
- [x] Make the sync step fail (for example by temporarily renaming a table in a scratch database) and start a run: the run still completes and is stored, and an error is logged

## Responsive checks (375, 768, 1280 px: no horizontal scroll, header and Sign out visible) (R10)
- [ ] Backlog page, including the wide table inside its wrapper and the sample notice
- [ ] Detail page with the score card, scenarios table, several fixes and the history
- [ ] Both loading skeletons
- [ ] Sidebar with the new link at 375 px

## Accessibility (R10)
- [ ] axe reports 0 WCAG 2.1 A and AA violations on both pages for staff and admin
- [ ] Status, flags and "not yet verified" are conveyed in words and shape, not colour alone
- [ ] Every form control has a visible label and the forms work from the keyboard; focus rings are visible
- [ ] The tables have a caption or heading and header cells with the right scope
- [ ] Heading order stays h1, h2, h3

## Quality of the logic itself
- [ ] Every state rule in `requirements.md` has a test that fails if the rule is removed
- [ ] The score is tested at effort 1, 2 and 3, with frequency 0, and with and without a severity override
- [ ] A run of an older version provably leaves a mode's state unchanged
- [ ] VERIFIED can be reached only by the sync; there is no path from the UI or a server action
- [ ] The sync is idempotent: running it twice for the same run changes nothing the second time and sends no second notification

## Traceability
| Requirement | Plan groups | Checks |
|---|---|---|
| R1 | 1 | theme tests, pinned results |
| R2 | 2, 3, 4 | migration test, `planSync` tests, sync tests, seed numbers, re-run flows |
| R3 | 3, 5, 6, 8 | score and ranking tests, staff flows |
| R4 | 2, 5, 8 | service tests, history, staff flows |
| R5 | 3, 4 | verification tests, seed numbers, staff flows |
| R6 | 3, 4 | `planSync` tests, seeded `d24`, reappearance flow |
| R7 | 4, 5 | notification tests, staff flows, reappearance flow |
| R8 | 7, 8 | guard tests, agent flow, input handling |
| R9 | 9 | seed numbers |
| R10 | 3, 8, 10 | lint, tsc, build, axe, responsive audit |

## Merge checklist
- [ ] All commands above pass on the branch `phase-9-failure-triage`
- [ ] New migration committed; earlier migrations untouched; `prisma/dev.db` and `.env*` not committed
- [x] Staff, admin and agent flows, and the reappearance trigger, walked through by hand in a browser
- [ ] Responsive and axe checks done with the committed audit script, which now covers the triage pages
- [ ] The formula in `specs/strategy.md` corrected; `README.md`, `specs/follow-ups.md` and the local changelog updated; Phase 9 marked `✓ Complete` in `specs/roadmap.md`
