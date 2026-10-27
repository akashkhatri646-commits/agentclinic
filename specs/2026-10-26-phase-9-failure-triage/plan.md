# Phase 9 — Failure Triage & Prioritized Fixes: Plan

Each group leaves the app working. Tests sit with the code they cover. Requirement ids (R1–R10) refer to `requirements.md`.

## Task Groups

### 1. Themes on scenarios (R1)
Goal: every scenario says what weakness it probes. No behaviour change yet.
- [ ] 1.1 Create `src/lib/evals/themes.ts`: the ten themes (id, label, one-line description) and helpers to look one up
- [ ] 1.2 Add a required `theme` to `Scenario` in `src/lib/evals/types.ts` and tag all 32 scenarios exactly as in the table in `requirements.md`
- [ ] 1.3 Tests: every scenario has a known theme; every theme is used at least once; theme ids and labels are unique; scenario counts per theme match the table; theme tagging does not change any scenario's expected answers or the pinned `v1` and `v2` results

### 2. Schema and migration (R2, R4)
Goal: somewhere to keep failure modes, fixes and their history.
- [ ] 2.1 Add `FailureMode` to `prisma/schema.prisma`: `specialistId`, `theme`, `status` (`OPEN` or `RESOLVED`), `frequency`, `totalScenarios`, `failingScenarioIds` and `regressedScenarioIds` (JSON text), `suggestedSeverity`, `severityOverride` (nullable), `effort` (default 2), `lastRunId`, `lastRunVersion`, `firstSeenAt`, `resolvedAt`, `reappeared`, `reappearedAt`, timestamps; unique on `specialistId` and `theme`
- [ ] 2.2 Add `Fix`: `failureModeId` (cascade), `title`, `description`, `ownerId` (nullable, FK to `User`), `status` (`PROPOSED`, `IN_PROGRESS`, `SHIPPED`, `VERIFIED`), `shippedVersion`, `shippedAt`, `verifiedAt`, `verifiedByRunId`, `createdById`, `isSample`, timestamps
- [ ] 2.3 Add `FixEvent`: `fixId` (cascade), `at`, `actorId` (nullable), `kind` (`CREATED`, `STATUS`, `OWNER`, `VERIFIED`), `fromStatus`, `toStatus`, `note`
- [ ] 2.4 Create the migration with `--create-only`, apply it, run `npx prisma generate`, and revert any cosmetic rewrite of `migration_lock.toml`
- [ ] 2.5 Confirm the migration applies cleanly on a database that already holds eval runs, results and Phase 8 data

### 3. Pure triage logic (R2, R3, R4, R5, R6)
Goal: every rule is a pure, tested function.
- [ ] 3.1 Create `src/lib/evals/triage.ts` with `groupByTheme(results, scenarios)` returning, per theme, its total scenarios and failing scenario ids
- [ ] 3.2 Add `severityWeight` (low 1, medium 2, high 3), `suggestSeverity(failingScenarios)` (the highest weight, or 1 with none), `effectiveSeverity(mode)` (override if set), and `priorityScore({ frequency, severity, effort })` with a guard against a zero or invalid effort
- [ ] 3.3 Add `rankBacklog(modes)`: open modes by score, then severity, then frequency, then label; resolved modes excluded
- [ ] 3.4 Add `canTransition(from, to)` and `nextStatuses(status)` for the allowed moves; verified is never reachable by hand
- [ ] 3.5 Add `planSync(modes, fixes, run)`: from the stored modes and fixes and a completed run, return the changes (modes to create, update, resolve or reopen; fixes to verify; owners to notify), following the state rules in `requirements.md`, including the rule that a run of an older version never changes a mode's state
- [ ] 3.6 Tests in `src/tests/evals-triage.test.ts` covering: grouping with and without failures; severity suggestion and override; score at the boundaries (effort 1, 2, 3; frequency 0); ranking and tie-breaks; every allowed and forbidden transition; and `planSync` for each state rule, a re-run of an older version, a re-run of the same version, a mode reappearing, a shipped fix verified when the version matches and not when the run is older, a shipped fix whose scenarios still fail, and two modes failing at once

### 4. Sync service and runner hook (R2, R5, R6, R7)
Goal: the backlog updates itself after every run.
- [ ] 4.1 Create `src/lib/evals/triage-sync.ts`: `syncFailureModes(run, db)` loads the stored state, calls `planSync`, applies the plan, writes fix events, and notifies owners (fail-soft)
- [ ] 4.2 Hook it into `runEval` after the run is stored, wrapped so a failure is logged and never fails the run; the runner accepts the same database client it already uses
- [ ] 4.3 Add small helpers for the JSON text columns (read and write a list of scenario ids)
- [ ] 4.4 Tests with a mocked database for the apply step (the right rows are written, fix events recorded, owners notified exactly once, nothing written when the plan is empty), a test that a sync failure does not fail the run, and updated runner tests that mock the sync

### 5. Fix and input services (R3, R4, R7)
Goal: staff actions, validated and recorded.
- [ ] 5.1 Create `src/lib/evals/triage-actions-lib.ts` (or similar) with `createFix`, `changeFixStatus`, `changeFixOwner` and `updateModeInputs`, each taking an explicit actor and an optional time
- [ ] 5.2 Validate every input: title 1 to 120 characters, description up to 1000, effort 1 to 3, severity override 1 to 3 or cleared, owner is an existing staff or admin user, shipped version is a registered version, and the transition is allowed
- [ ] 5.3 Write a `FixEvent` for every change; notify a new owner on creation or reassignment (not when someone assigns themselves)
- [ ] 5.4 Tests for each validation failure, each success, the event written, the notification rules, and that VERIFIED cannot be set by hand

### 6. Queries (R3, R8)
- [ ] 6.1 `getBacklog(specialistId)`: ranked open modes with their score inputs and fix summaries, the resolved modes, summary counts, and which version and run the backlog reflects
- [ ] 6.2 `getFailureModeDetail(id)`: the mode, its scenarios with their result in the current state, its fixes with owners and events, and the regressed scenarios
- [ ] 6.3 `getAssignableOwners()`: staff and admin users
- [ ] 6.4 Tests for ranking and for the summary figures using a fixed set of rows

### 7. Guards and server actions (R8)
- [ ] 7.1 Add `canViewTriage` and `canManageTriage` (staff and admin) to `src/lib/guards.ts` with tests for each role and unknown or empty roles
- [ ] 7.2 `src/app/dashboard/triage/actions.ts`: `updateInputsAction`, `createFixAction`, `changeFixStatusAction`, `changeFixOwnerAction`. Each checks the session and role, passes the signed-in user as the actor, and reports problems through short error codes mapped to fixed messages (never text from the URL)
- [ ] 7.3 Tests for the error-code mapping and that unknown codes are ignored

### 8. Pages and navigation (R3, R4, R5, R6, R8, R10)
- [ ] 8.1 `src/app/dashboard/triage/page.tsx`: role guard; what the backlog reflects (version and run); summary tiles (open failure modes, failing scenarios, fixes in flight, verified fixes, flagged); the ranked backlog table with rank, theme, frequency as "x of y", severity, effort, score, fix summary and flags; the resolved modes; a sample notice when sample fixes exist; `EmptyState` with no runs
- [ ] 8.2 `src/app/dashboard/triage/[modeId]/page.tsx`: status and flags in words; the score card with each input and the formula, an editable severity override and effort, and the computed score; the scenarios with their current result and any regression; the fixes with owner, status, shipped version, the verifying run and "not yet verified" where it applies; history events; forms to add a fix, move it on, and change its owner; `notFound` for an unknown id
- [ ] 8.3 `loading.tsx` skeletons for both routes; sidebar link "Triage" for staff and admin
- [ ] 8.4 Status and flag labels use words and shape, never colour alone; styles in `globals.css`
- [ ] 8.5 Check 375 / 768 / 1280 px, including the wide backlog table inside the scrolling wrapper

### 9. Seed (R9)
- [ ] 9.1 Clear triage data when the seed clears eval data, so the seed stays idempotent
- [ ] 9.2 Between the `v1` and `v2` runs, create the illustrative fixes (flagged `isSample`, with backdated times and owners from the seeded users): verified-to-be fixes for `expectation-gap`, `fabrication-vocabulary`, `persistent-wording` and `negation` shipped in `v2`; for `sarcasm-and-idiom` one fix shipped in `v2` (it will stay unverified, because the scenarios still fail) and one proposed; for `frequency-vs-intensity` one in progress
- [ ] 9.3 Let the `v2` run verify the four fixes through the real sync, then check the result matches the numbers in `validation.md`
- [ ] 9.4 Put the sample fix definitions in one small module with a comment that they are invented, so the seed and tests share them

### 10. Quality pass and docs (R10)
- [ ] 10.1 `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` all clean; note first-load JS for the new routes
- [ ] 10.2 Extend `scripts/audit.js` with the triage pages for staff and admin and add them to the agent's forbidden pages; run it at 375 / 768 / 1280 px and resolve every violation
- [ ] 10.3 Walk the manual flows in `validation.md` in a browser, including the reappearance trigger (delete an unused therapy, re-run `v2`, then restore it with a reseed)
- [ ] 10.4 Correct the formula in `specs/strategy.md` (× effort should read ÷ effort); update `README.md`, `specs/follow-ups.md` and the local changelog
- [ ] 10.5 Mark Phase 9 `✓ Complete` in `specs/roadmap.md` when merged
