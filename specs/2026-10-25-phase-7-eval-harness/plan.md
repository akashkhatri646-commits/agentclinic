# Phase 7 — Eval Harness & Quality Verdicts: Plan

Each group leaves the app working. Tests sit with the code they cover. Requirement ids (R1–R9) refer to `requirements.md`.

## Task Groups

### 1. Schema & migration (R3)
Goal: a place to store runs and per-scenario results.
- [ ] 1.1 Add `EvalRun` to `prisma/schema.prisma`: id, specialistId, version, status (kept simple, e.g. `COMPLETED`), devTotal, devPassed, holdoutTotal, holdoutPassed, verdict (`PASS`/`FAIL`), verdictReason, judgeEnabled, triggeredBy (nullable, a user id or `cli`), createdAt, with an index on `(specialistId, version, createdAt)`
- [ ] 1.2 Add `EvalResult`: id, runId (FK to `EvalRun`, cascade delete), scenarioId, split (`DEV`/`HOLDOUT`), passed, category (nullable), reason (nullable), expectedSeverity, expectedTherapy, actualSeverity, actualTherapy, rationale, judgeScore (nullable int), judgeNote (nullable)
- [ ] 1.3 Create a new migration under `prisma/migrations/` (do not edit earlier migrations); run `npx prisma generate`; confirm `npx prisma migrate status` is up to date
- [ ] 1.4 Revert any cosmetic rewrite Prisma makes to `migration_lock.toml` so the diff stays clean

### 2. Specialist, versions and scenarios (R1, R2)
Goal: the thing under test, defined and versioned, plus its golden set. No UI yet.
- [ ] 2.1 Create `src/lib/evals/types.ts`: `Severity`, `Split`, `SpecialistInput` (description plus therapy names), `SpecialistOutput` (severity, therapy, rationale), `Scenario`, `SpecialistVersion` (id, version, summary, run function)
- [ ] 2.2 Create `src/lib/evals/specialists/intake-triage-v1.ts`: rule-based baseline that deliberately has gaps (for example, ignores negation and phrases like "mild", maps few keywords to therapies)
- [ ] 2.3 Create `src/lib/evals/specialists/intake-triage-v2.ts`: fixes the `v1` gaps; keep a short comment on what changed per rule
- [ ] 2.4 Create `src/lib/evals/specialists/index.ts`: registry listing versions in order, with `getSpecialistVersion` and `getPreviousVersion`
- [ ] 2.5 Create `src/lib/evals/scenarios/intake-triage.ts`: about 32 scenarios (24 `DEV`, 8 `HOLDOUT`), each with an id, description, expected severity, expected therapy name (from the seeded catalogue), and a one-line `why` so reviewers can challenge it. Cover all three severities and all five therapies, plus a few tricky phrasings
- [ ] 2.6 Tests in `src/tests/evals-specialists.test.ts`: both versions are deterministic and return only valid severities and catalogue therapies; `v1` and `v2` outputs differ on the known gap scenarios; scenario ids are unique; split counts are as intended; every expected therapy exists in the seed catalogue names

### 3. Checks and verdict logic (R4, R6)
Goal: pure, well-tested decision code.
- [ ] 3.1 Create `src/lib/evals/checks.ts`: `runChecks(scenario, output, catalogue)` returning `{ passed, category, reason }`; categories `SEVERITY`, `THERAPY`, `THERAPY_NOT_IN_CATALOGUE`, `SEVERITY_AND_THERAPY`, `RATIONALE`, with reasons that name expected versus actual
- [ ] 3.2 Create `src/lib/evals/verdict.ts` with named constants `DEV_PASS_THRESHOLD = 0.85` and `MAX_HOLDOUT_GAP = 0.10`; `computeVerdict(devPassed, devTotal, holdoutPassed, holdoutTotal)` returning verdict and a reason; handle empty splits without dividing by zero
- [ ] 3.3 In `verdict.ts`, add `summariseFailures(results)` (counts by category) and `compareRuns(current, previous)` returning the rate deltas, scenarios fixed (failed before, pass now), and scenarios regressed (passed before, fail now), matched by scenario id
- [ ] 3.4 Tests in `src/tests/evals-verdict.test.ts` and `src/tests/evals-checks.test.ts`: each category and reason; thresholds at the boundary (84.9% and 85%); the overfit case (dev high, hold-out low) fails with the gap reason; empty hold-out; compare with fixed, regressed, and unchanged scenarios; compare with no previous run

### 4. Runner and persistence (R3, R4)
Goal: run a version end to end and store the result.
- [ ] 4.1 Create `src/lib/evals/runner.ts`: `runEval({ specialistId, version, triggeredBy, judge?, db? })` loads the therapy catalogue from the database, runs each scenario, applies checks, computes the verdict, and writes the run and its results in one transaction. `db` defaults to the shared Prisma client
- [ ] 4.2 Reject an unknown specialist or version with a clear error; an empty therapy catalogue is reported as a failed environment (every scenario fails with a clear reason) rather than a crash
- [ ] 4.3 Create `src/lib/evals/queries.ts`: `getEvalRuns`, `getEvalRunById` (with results), `getLatestRunForVersion`, `getPreviousVersionRun`
- [ ] 4.4 Tests in `src/tests/evals-runner.test.ts` using an injected fake `db`: one result per scenario; counts and verdict stored correctly; unknown version rejected; empty catalogue handled; the transaction is used; `triggeredBy` recorded. Include a regression test pinning that `v1` yields `FAIL` and `v2` yields `PASS` on the shipped scenarios

### 5. Optional LLM judge (R5)
Goal: a rationale-quality check that is entirely opt-in.
- [ ] 5.1 Consult the `claude-api` skill, then add `@anthropic-ai/sdk` as a dependency
- [ ] 5.2 Create `src/lib/evals/judge.ts`: a `Judge` interface (`score(description, rationale) -> { score 1–5, note }`); `createAnthropicJudge()` returns `null` when `ANTHROPIC_API_KEY` is unset; imports the SDK lazily; model `claude-haiku-5-5`; the response is validated (integer 1–5) and a malformed reply is treated as "no score"
- [ ] 5.3 Wire the judge into the runner for scenarios that passed the deterministic checks only. A score below 3 fails that scenario with category `RATIONALE`; a judge error or malformed reply leaves `judgeScore` empty with a note and does not fail the scenario; the run records `judgeEnabled`
- [ ] 5.4 Tests in `src/tests/evals-judge.test.ts` with a fake judge and a mocked SDK: no key returns `null`; low score fails with `RATIONALE`; high score passes; a thrown error and a malformed reply are non-fatal; the judge is not called for already-failed scenarios

### 6. CLI and seed (R7)
Goal: the same library from a terminal, and real data on a fresh install.
- [ ] 6.1 Create `scripts/eval.ts` and an `npm run eval` script: arguments `--version v1|v2` (default: all versions in order) and `--judge`; prints pass rates, verdict, and failed scenarios; exits non-zero when the verdict is `FAIL` so it can gate CI later
- [ ] 6.2 Extend `prisma/seed.ts` to run the real runner for `v1` then `v2` using the seed's own database client, after therapies are seeded; keep the seed idempotent (clear previous eval rows first)
- [ ] 6.3 Tests for argument parsing in the CLI (kept in a pure function so it can be tested without a database)
- [ ] 6.4 Run `npx prisma db seed` and `npm run eval -- --version v1` and `v2`; confirm `FAIL` and `PASS` respectively

### 7. Access guard and server action (R8)
Goal: staff-only, enforced server-side.
- [ ] 7.1 Add `canRunEvals(role)` and `canViewEvals(role)` to `src/lib/guards.ts` (staff and admin)
- [ ] 7.2 Create `src/app/dashboard/evals/actions.ts` with `runEvalAction`: checks the session and role, validates the version against the registry, runs the eval (judge only if requested and a key exists), and redirects to the new run; errors return via a short error code rather than raw text in the query string
- [ ] 7.3 Tests: guard cases for each role and unknown or empty roles in `src/tests/guards.test.ts`; unknown version rejected

### 8. Evals UI (R6, R7, R9)
Goal: staff can start a run and read a clear verdict.
- [ ] 8.1 `src/app/dashboard/evals/page.tsx`: list of runs (version, verdict, dev rate, hold-out rate, date, link); a run form with a version select and, only when a key is configured, a "Use LLM judge" checkbox; `EmptyState` when there are no runs; page-level role guard
- [ ] 8.2 `src/app/dashboard/evals/[runId]/page.tsx`: verdict banner (the word PASS or FAIL, not colour alone) with its reason; dev and hold-out rates and the gap; failures by category; table of failed scenarios (expected versus actual, reason, judge note); comparison with the previous version (deltas, fixed, regressed) or a "no previous version" message; `notFound` for an unknown id
- [ ] 8.3 `loading.tsx` skeletons for both routes
- [ ] 8.4 Add an "Evals" link to the sidebar for staff and admin only
- [ ] 8.5 Add the badge styles (PASS/FAIL) to `globals.css` using text plus colour; keep tables inside the scrolling `figure` wrapper
- [ ] 8.6 Check 375 / 768 / 1280 px on both pages

### 9. Quality pass and docs (R9)
Goal: ready to merge.
- [ ] 9.1 `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` all clean; note first-load JS for the new routes and confirm the SDK is not in any client bundle
- [ ] 9.2 Commit the axe and responsive audit script under `scripts/` (the follow-up noted in `specs/follow-ups.md`), extend it to the new pages, and run it at 375 / 768 / 1280 px for staff and admin; resolve all WCAG 2.1 A and AA violations
- [x] 9.3 Walk the manual flows in `validation.md` by hand, not only over HTTP
- [ ] 9.4 Update `README.md` (Phase 7 built, how to run `npm run eval`), `specs/strategy.md` status, `specs/follow-ups.md` (remove the committed-audit-script note, add anything found), and the local changelog
- [ ] 9.5 Mark Phase 7 `✓ Complete` in `specs/roadmap.md` when merged
