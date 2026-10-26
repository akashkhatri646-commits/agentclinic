# Phase 10 — Self-Serve Onboarding & Customer Instances: Validation

## Commands that must pass
- [ ] `npx prisma migrate status` reports the database up to date; `npx prisma generate` succeeds (R3)
- [ ] The migration applies to a database that already holds eval runs and results, with row counts before and after equal, and a sample of backfilled results showing the right `expected` and `actual` JSON and mapped categories (R3, R14)
- [ ] `npm test`: all tests pass, none skipped (the existing 569, with each deliberately rewritten test justified in the commit, plus new format, grading, characterisation, store, instance, merge, outputs, onboarding and adoption tests) (R1–R12)
- [ ] The characterisation test passes: the generic engine and the old engine agree on every scenario for `v1` and `v2`, with the seeded therapies, with one therapy removed, and with none (R2, R14)
- [ ] `npx tsc --noEmit`: no errors
- [ ] `npm run lint`: no errors or warnings
- [ ] `npm run build`: succeeds; first-load JS for the new routes noted and under 250 kB (R13)
- [ ] `npx prisma db seed` on a fresh database completes and produces exactly the content below (R11)
- [ ] `npm run eval -- --specialist intake-triage --version v1` exits 1 with 17 failing scenarios, and `--version v2` exits 0 with exactly `d23`, `d24` and `h08` failing, on the default instance (R5, R14)

## What the seeded database must show (R6, R9, R11, R14)

### Unchanged from Phases 7 to 9
- [ ] `v1` fails 17 scenarios (12 of 24 dev, 3 of 8 hold-out); `v2` fails `d23`, `d24` and `h08` (22 of 24 dev, 7 of 8 hold-out)
- [ ] Metrics for intake-triage: loop time 21.0 days for `v1` and 2.0 days for `v2`, median 11.5 days; 15 scenarios fixed and 1 regression detected
- [ ] Triage for intake-triage: 8 failure modes, 2 open (`sarcasm-and-idiom` 2 of 2 scored 2.0 with `d24` regressed, `frequency-vs-intensity` 1 of 1 scored 1.0), 6 resolved, 4 fixes verified by the `v2` run

### New
- [ ] Three instances exist: the standard clinic (live catalogue), a short-staffed clinic (no Human Expectation Recalibration), and a regional catalogue (renamed therapies)
- [ ] Four specialists exist: intake-triage (the worked example, owned by admin), and three sample specialists owned by staff, all flagged as sample except the intake-triage definition itself
- [ ] The Adoption section reads: 4 specialists, 4 reached a verdict, 3 fully onboarded, 2 of those 3 unassisted (66.7%), median time to first verdict 5.5 days (2.0, 2.0, 9.0 and 21.0 days)
- [ ] The sample notice is shown wherever sample specialists, runs or fixes appear

## Manual flows

### Onboard a specialist from a template (staff) (R1, R4, R5, R8)
- [ ] Open New specialist, choose the classification starter: the JSON box is pre-filled; change the slug and name and save
- [ ] The Onboarding checklist shows the specialist created and the scenario step satisfied, and the remaining steps not yet done
- [ ] Open Import outputs, use the empty skeleton, fill in the values, choose an instance, enter a version label and a release time, and import: a verdict appears, the checklist ticks the version and verdict steps, and loop time is measured from the release time
- [ ] Failing scenarios appear as failure modes on the Triage page for this specialist, grouped by the themes in the config
- [ ] Create a fix, ship it in the version, import corrected outputs for the same or a newer version: the fix is verified by the run, the owner is notified, and the checklist is complete
- [ ] A specialist onboarded entirely by its owner counts as unassisted in the Adoption section

### Assistance (admin) (R9)
- [ ] An admin who is not the owner imports outputs for a staff-owned specialist before its first verified fix: the specialist counts as assisted; an admin acting on a specialist they own does not

### Validation messages (R1, R5, R12)
- [ ] Each of these is refused with a message that names the place, and nothing is saved: malformed JSON; wrong or missing `format`; a duplicate scenario id; a scenario with an unknown theme; a check naming a field that does not exist; an `equals` field with no expected value; a weight of 0 or 4; no DEV scenario; more than 200 scenarios; a file over 200 KB; a field named `__proto__`
- [ ] Outputs refused with precise errors: a missing scenario (named), an unknown scenario (named), a missing field, a first-time version with no `releasedAt`, a release time in the future, a release time earlier than the latest version's, an unknown instance
- [ ] Text with markup in a name, theme label, input or `why` is displayed as plain text

### Definition changes (R4)
- [ ] The owner adds a scenario after the first run: allowed, and the next run covers it
- [ ] Removing a scenario, renaming a scenario id, or removing a theme that stored results or failure modes use is refused with a message naming it
- [ ] A staff user who is not the owner cannot change another team's specialist: the page, the form and a direct action call are all refused

### Customer instances (R6)
- [ ] Run intake-triage `v2` on the short-staffed clinic: the expectation scenarios fail with a "not in the reference list" reason, and the failure mode for human expectation gaps reopens
- [ ] That failure mode says its latest change came from the run on the short-staffed clinic, and lists which scenarios fail on which instance
- [ ] The Metrics and Triage pages say which instances they considered; the pass rate and the failing counts are the worst case across them
- [ ] Re-running `v2` on the standard clinic alone does not clear the failure mode while the short-staffed run still fails
- [ ] A fix to that mode is verified only once the scenarios pass on both instances
- [ ] "Run on all instances" runs the built-in version on each instance in turn
- [ ] An older version's run on any instance changes no failure mode's state

### Pickers and pages (R7)
- [ ] The picker on Evals, Metrics and Triage switches between all four specialists, keeps the choice when moving between the three pages, and ignores an unknown slug
- [ ] The Specialists list shows each specialist's owner, versions, scenarios, runs, instances covered and progress

### Agent (R12)
- [ ] No new link is shown to an agent; visiting any new page redirects to a normal page with no content; calling any new action directly is refused and changes nothing

### Resilience (R5)
- [ ] An import whose triage sync fails still stores the run and says nothing is lost; a failing judge does not fail a run

## Responsive checks (375, 768, 1280 px: no horizontal scroll, header and Sign out visible) (R13)
- [ ] Specialists list, new, detail, edit and import pages, including long validation error lists
- [ ] Onboarding checklist
- [ ] Evals, Metrics and Triage with the picker and the instance notes
- [ ] The Adoption section; all loading skeletons; the sidebar with the new links at 375 px

## Accessibility (R13)
- [ ] axe reports 0 WCAG 2.1 A and AA violations on every new or changed page for staff and admin
- [ ] Every control has a visible label and works from the keyboard; error lists are announced (an alert region) and linked to the field; focus is visible
- [ ] Checklist status is written in words (done, not done), not colour alone
- [ ] Tables have captions and header scopes; heading order stays h1, h2, h3

## Quality of the logic itself (R2, R6, R9, R14)
- [ ] Every check type has a test on both sides of its boundary; every validation rule has a test that fails if the rule is removed
- [ ] The merge rule is tested for one instance, many, disjoint failures, and a missing run
- [ ] `isAssisted` is tested for each actor and for acting after the first verified fix
- [ ] Imported outputs are provably never executed or fetched: there is no code path that calls out to a URL, evaluates input, or spawns a process
- [ ] Re-importing the same config unchanged is a no-op, and applying the same outputs twice creates two runs, not a corrupted state

## Traceability
| Requirement | Plan groups | Checks |
|---|---|---|
| R1 | 1 | format tests, validation messages |
| R2 | 2, 5 | grading tests, characterisation test, pinned numbers |
| R3 | 3, 4 | migration check, store tests |
| R4 | 4, 7, 8 | template tests, definition-change flows, permissions |
| R5 | 5, 7, 8 | outputs tests, onboarding flow, CLI check |
| R6 | 6, 9 | merge tests, instance flows |
| R7 | 8, 9 | picker and page flows |
| R8 | 10 | checklist tests and flow |
| R9 | 10, 11 | adoption tests, seeded adoption numbers |
| R10 | 12 | playbook reviewed, links checked |
| R11 | 11 | seed numbers |
| R12 | 1, 7 | guard tests, validation messages, agent flow |
| R13 | 8, 9, 10, 13 | lint, tsc, build, axe, responsive audit |
| R14 | 2, 3, 5, 6, 11 | characterisation test, migration check, seeded numbers, CLI check |

## Merge checklist
- [ ] All commands above pass on the branch `phase-10-self-serve-onboarding`
- [ ] New migration committed; earlier migrations untouched; `prisma/dev.db` and `.env*` not committed
- [ ] Every rewritten test is justified in its commit message; no test was deleted just to make the suite pass
- [ ] The onboarding flow, the assistance flow, the definition-change flow and the instance spread walked through by hand in a browser
- [ ] Responsive and axe checks done with the audit script covering the new pages
- [ ] `docs/playbook.md` reviewed; the README, strategy doc, follow-ups and changelog updated; Phase 10 marked `✓ Complete` in `specs/roadmap.md`

---

## Results (recorded at the end of implementation)

Everything above was checked on branch `phase-10-self-serve-onboarding`. Items are ticked in the lists above only where the evidence below covers them; the deviations are listed so nothing reads as better than it is.

### Commands

| Check | Result |
|---|---|
| `npm test` | 35 files, 931 tests passing, none skipped. The earlier 569 became 569 minus the deleted `evals-checks` tests, with the rest rewritten or kept; every rewritten test is explained in the commit that rewrote it |
| `npx tsc --noEmit` | clean |
| `npm run lint` | no warnings or errors |
| `npm run build` | succeeds; the new routes are 96.2 to 97.3 kB first-load JS (limit 250 kB) |
| Migrations | applied to the development database that held Phase 7 to 9 data: 2 runs and 64 results before and after the first migration; values and categories backfilled and spot-checked (d05, d06, d23 on `v1`); the second migration drops the old result columns |
| `npm run eval` (default instance) | `v1` FAIL 12/24 dev and 3/8 hold-out; `v2` PASS 22/24 and 7/8 failing exactly d23, d24 and h08 |
| Seed on a fresh run | 3 instances; 8 failure modes with 2 open and 4 fixes verified by the `v2` run (all unchanged from Phase 9); 3 sample specialists created through the real code |
| Mutation checks | Deliberately breaking rules made the suite fail each time: format (reserved names, the DEV rule, unknown properties, missing expected values), grading (reference check, equals, all-checks rule), store (the has-runs rule, slug change, unchanged short-circuit, scenario order), outputs (ordering, future release time, missing scenarios), service (ownership on import, undoing a registered version), onboarding (owner counted as assistance, the cutoff, staff counted as admin, onboarded without a verified fix) |

### Seeded numbers

- Adoption section: **4 specialists, 4 with a verdict, 3 fully onboarded, 2 of those unassisted (66.7%), median time to first verdict 5.5 days** (21.0, 2.0, 2.0 and 9.0 days). Matches what was predicted.
- **Deviation:** the spec predicted "3 sample specialists, all flagged except intake-triage". As built, a specialist with sample runs counts as sample, and the intake-triage specialist's seeded runs are sample, so **all 4 are shown as including sample data**. Its definition is real; its dates are the illustrative ones.
- **Deviation:** the intake-triage specialist's creation date is backdated to the day `v1` shipped on the invented timeline, so its time to first verdict reads 21 days. That is illustrative, like the run timings.

### Manual flows

Walked in headless Chrome by a script, not by hand in a browser:

- Template to verified fix as staff: a deliberately bad theme is refused with `scenarios[0].theme` and the real themes, nothing saved and no error text in the URL, the typed text kept; the valid config creates a specialist owned by the creator; the checklist reads 2 of 6; a new version without a release time is refused; `v1` imports to a FAIL verdict naming the instance; the Edge cases failure mode shows 3 of 5 failing; a proposed fix is in progress; a second `v2` import ships it; the corrected `v2` run passes, resolves the mode, verifies the fix and the checklist reads "Onboarded"; the Metrics page shows the Adoption section.
- Permissions: a staff member who is not the owner sees no edit or import buttons, and opening edit or import directly sends them back; the owner sees both; an unknown specialist is a 404; an agent opening any new page lands on a normal page with no content and sees no specialist or onboarding links.
- Instances: `v2` on the short-staffed clinic fails with the missing-therapy reason; Triage and Metrics say "worst case across Standard clinic, Short-staffed clinic"; the expectation-gap failure mode reappears; "All instances" makes one run on each instance.
- The fix steps in the template walk used the fix service rather than the triage forms (typing into the triage form from the script was unreliable; those forms were walked in Phase 9). The triage forms themselves were not re-walked here.

### Not covered by the walks above

- Assisted versus unassisted was checked by unit tests and the seeded story (a seeded admin import), not by an admin acting on a staff-owned specialist in the browser.
- Direct calls to the server actions from another staff member are covered by service tests (role and ownership re-checked), not by crafted HTTP requests.
- Definition changes after runs (adding allowed, removing refused) are covered by unit tests of the store and the service, not by the edit page.
- File upload into the paste box.
- Nothing was run against the real LLM API.
- A screen reader.

### Audit

`npm run audit`, run in parts to keep memory low, then in full: **0 failing everywhere**: specialists 36 checks, onboarding 12, evals 24, metrics 12, triage 60, ailments 30, therapies 3, notifications 9, and the full run 201 checks. axe reported no WCAG 2.1 A or AA violations at 1280 px, there is no horizontal overflow or clipped Sign out button at 375, 768 or 1280 px, and agents are kept out of the new pages.

### Where the plan changed

- The old `EvalResult` columns were kept for one group and dropped by a second migration, so the app worked after every group.
- The old checks were removed once the generic engine had been proved against them, so the old-versus-new comparison no longer exists; the pinned results are the guard.
- Failure categories are now `TYPE:field` (for example `MISMATCH:severity`), as the requirements said; the old names are mapped by the migration.
- The paste box is an uncontrolled text area so typing before the page finishes loading is not lost.
