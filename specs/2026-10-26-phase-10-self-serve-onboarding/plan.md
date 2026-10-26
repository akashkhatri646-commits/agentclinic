# Phase 10 — Self-Serve Onboarding & Customer Instances: Plan

The riskiest work comes first and every group leaves the app working. Requirement ids (R1–R14) refer to `requirements.md`. The old engine stays in place until the characterisation test in group 2 passes and group 5 switches over.

## Task Groups

### 1. The format, in types and validation (R1, R12)
Goal: a pure, well-tested description of a specialist. No behaviour change.
- [x] 1.1 Create `src/lib/evals/spec.ts` with the types: `OutputField`, `Check` (a union of `equals`, `oneOf`, `inReference`, `nonEmpty`), `ThemeDef`, `ScenarioSpec`, `JudgeSpec`, `SpecialistSpec`, and `InstanceSpec` (a name and its reference lists)
- [x] 1.2 Add Zod schemas and `validateSpecialistConfig(text)`: parses JSON, enforces the limits in `requirements.md` (size, counts, lengths, key patterns), the cross-field rules (unique scenario ids, themes exist, checks name real fields, `inReference` and `oneOf` are well formed, an `expected` value for every `equals` field, at least one DEV scenario, weight 1 to 3), and returns either the config or a list of errors with a path and a message
- [x] 1.3 Make the error messages specific and friendly (for example `scenarios[3].theme: "biling" is not one of the themes (billing, shipping)`), capped at a sensible number so a bad file cannot produce a huge response
- [x] 1.4 Tests in `src/tests/evals-spec.test.ts`: a valid config for each of the three templates; every rule above as a failing case with its exact message; malformed JSON; wrong `format`; too large; `__proto__` and `constructor` as field names and theme ids; very long strings; duplicate ids; a theme or field referenced but missing; and that no error list exceeds its cap

### 2. A generic grading engine, proved against the old one (R2, R14)
Goal: the same verdicts from a domain-neutral engine, before anything depends on it.
- [x] 2.1 Create `src/lib/evals/grade.ts` with `runChecks(scenario, output, spec, lists)` for each check type, producing a pass flag, a category (sorted failing `TYPE:field` joined by `+`) and a reason; text values are compared trimmed and case-sensitive, and numbers and booleans are converted to text
- [x] 2.2 Add `gradeOutputs({ spec, outputs, lists, judge? })`: applies the checks to every scenario, applies the optional judge to scenarios that passed the checks (same rules as today: only a returned low score fails; errors are non-fatal), and returns the per-scenario rows and counts; the verdict still comes from `computeVerdict`
- [x] 2.3 Write the intake-triage specialist as a `SpecialistSpec` (fields severity, therapy, rationale; checks equals severity, equals therapy, inReference therapy in `therapies`, nonEmpty rationale; the ten themes; the 32 scenarios with weights 1 to 3 from their expected severity; a judge on rationale)
- [x] 2.4 **Characterisation test** in `src/tests/evals-characterisation.test.ts`: for `v1` and `v2` against the seeded therapy list, and against lists with one therapy removed and with none, the generic engine and the existing engine agree on pass or fail for every scenario and on the counts and verdict. Also pin the totals: `v1` 12 of 24 dev and 3 of 8 hold-out, `v2` 22 of 24 and 7 of 8
- [x] 2.5 Tests in `src/tests/evals-grade.test.ts` for each check type on both sides of its boundary, multiple failing checks in one scenario, a missing output field, a reference list the instance does not have (a clear failure, not a crash), and the judge rules

### 3. Schema and migration (R3, R14)
Goal: tables for everything new, and stored results moved to the generic shape.
- [x] 3.1 Add `Specialist`, `SpecialistScenario`, `SpecialistVersion`, `Instance` and `SpecialistEvent` to `prisma/schema.prisma` as described in `requirements.md`; the definition parts (fields, checks, themes, judge) as validated JSON text
- [x] 3.2 Add `instanceSlug` (default `standard-clinic`) and `outputsSource` (`BUILTIN` or `IMPORTED`, default `BUILTIN`) to `EvalRun`
- [x] 3.3 Change `EvalResult` to carry `expected` and `actual` as JSON text instead of the severity and therapy columns and the rationale column _(done in two steps so the app kept working: the new columns and backfill first, the old columns dropped in group 5 by migration `20261026190000_phase10_generic_results`)_
- [x] 3.4 Create the migration with `--create-only`, then edit it to backfill: build `expected` and `actual` from the old columns with SQLite's `json_object`, map the old categories to the new `TYPE:field` form (SEVERITY, THERAPY, SEVERITY_AND_THERAPY, THERAPY_NOT_IN_CATALOGUE, RATIONALE), and leave every other value alone
- [x] 3.5 Verify on a database that already holds runs and results: row counts before and after, and that a sample of backfilled rows has the right JSON and category; revert any cosmetic rewrite of `migration_lock.toml`

### 4. Persistence, templates and instances (R3, R4, R6)
Goal: specialists live in the database and can be created from config.
- [x] 4.1 Create `src/lib/evals/specialist-store.ts`: load a specialist as a `SpecialistSpec` with its ordered versions; list specialists; create from a validated config (owner, slug uniqueness, an event recorded); update by replacing the definition under the add-only rule once runs exist (refusing removed or renamed scenarios, fields, themes or checks that stored data depends on)
- [x] 4.2 Create `src/lib/evals/templates.ts` with the three templates (intake-triage example, classification starter with about 12 scenarios across two themes and a hold-out set, blank starter), each a valid config; a test validates all three
- [x] 4.3 Create `src/lib/evals/instances.ts`: list instances; resolve an instance's reference lists (the standard clinic reads the live therapy names; the others are stored snapshots); a clear error for an unknown instance
- [x] 4.4 Create `src/lib/evals/builtin.ts`: the code-defined versions (`intake-triage` `v1` and `v2`) keyed by name, producing an output object per scenario input; built-in versions record their key
- [x] 4.5 Tests for the store with a mocked database (create, slug clash, owner recorded, add-only refusals each with their message, view and list ordering), for instance resolution (live and static), and for the built-in registry

### 5. Switch the runner and its callers to the generic path (R2, R5, R14)
Goal: one grading path, no hard-coded specialist, same numbers.
- [x] 5.1 Rework `src/lib/evals/runner.ts`: `runEval` takes a specialist slug, a version and an instance; built-in versions generate their outputs from code; imported outputs arrive from group 7; both pass through `gradeOutputs`; the run records its instance and source, and the three timestamps as before
- [x] 5.2 Update the callers: `start.ts` (the run action), `scripts/eval.ts` (add `--specialist` and `--instance`, defaults unchanged), the judge wiring, and the stored-result readers
- [x] 5.3 Let a built-in run be started on one instance or on every instance, in a loop with the same options
- [x] 5.4 Remove the old severity-and-therapy checks and the hard-coded registry lookups once nothing uses them _(the scenario-by-scenario comparison with the old engine passed before the switch; once the old engine was gone the characterisation test was reduced to the pinned results plus a check that a smaller catalogue never passes more)_
- [x] 5.5 Rewrite the tests that pinned the old categories and reasons for the new generic ones, and record the reason in each changed test; run the whole suite and confirm the pinned results (`v1` 17 failing, `v2` exactly `d23`, `d24`, `h08`) are untouched

### 6. Triage, metrics and the sync, for any specialist and worst case across instances (R6, R14)
Goal: the Phase 8 and 9 behaviour, generalised.
- [x] 6.1 Add a pure `mergeLatestPerInstance(runs, version)` returning per-scenario results that pass only if they pass in every instance's latest run, plus which instances failed each scenario; tested for one instance, several, one failing everywhere, disjoint failures, and instances with no run of the version
- [x] 6.2 Make the triage sync build the state from the merged results, take scenario weights and theme labels from the specialist, and take version order and previous-version comparison from the database; the `run` it passes to `planSync` is the triggering run with the merged results
- [x] 6.3 Make the metrics use the merged results for pass rates and for scenarios fixed and regressed, still use each version's first verdict for loop time, and the same-instance rule for comparison on the verdict page
- [x] 6.4 Generalise `triage.ts` (weights replace expected severity, themes come from the specialist), `triage-view.ts` and `triage-queries.ts`, and the dashboard summary helper (default specialist)
- [x] 6.5 Tests: merge rules; a run on a second instance reopening a resolved mode; a fix verified only when it passes on every recorded instance; an older-version run changing nothing; and that with only the standard instance every Phase 8 and 9 number is exactly as before

### 7. Import outputs, activity and permissions (R4, R5, R12)
Goal: teams can get a verdict without touching code.
- [x] 7.1 Create `src/lib/evals/outputs.ts`: `validateOutputs(text, spec)` for the outputs format (size, structure, every scenario present, no unknown scenario, every field present, `releasedAt` rules for a new version, ordering after the latest version, not in the future) with path-and-message errors
- [x] 7.2 `importOutputs`: registers the version if new, grades the outputs for the chosen instance through `gradeOutputs`, records the run with source `IMPORTED` and the actor, writes an activity event, and runs the triage sync
- [x] 7.3 Add guards (`canViewSpecialists`, `canCreateSpecialist`, `canManageSpecialist(role, userId, ownerId)`) with tests for every role, the owner, a non-owner staff, admin, and unknown roles
- [x] 7.4 Server actions for create, update and import that re-check the session and role, verify ownership, take the actor from the session, and return structured errors for the form (never error text in the URL)
- [x] 7.5 Tests for every validation failure and success, for refused non-owners, for the activity event, and for a failed sync not failing the import

### 8. Pages to manage specialists (R4, R5, R7)
- [x] 8.1 A shared specialist picker (a small GET form) that validates `?specialist=` and defaults to the first specialist
- [x] 8.2 `/dashboard/specialists`: a list with owner, versions, scenario count, runs, instances covered and onboarding progress, plus a New specialist button
- [x] 8.3 `/dashboard/specialists/new`: a template chooser that pre-fills the JSON box, a file upload, validation errors listed with their paths (a client form using `useFormState`)
- [x] 8.4 `/dashboard/specialists/[slug]`: the definition (fields, checks, themes), the scenarios by theme and split, the versions, the owner and activity, and, for the owner or an admin, links to edit and to import outputs
- [x] 8.5 `/dashboard/specialists/[slug]/edit` and `/import`: the same client-form pattern; the import page selects a version label and an instance and can pre-fill an empty skeleton listing every scenario id
- [x] 8.6 Loading skeletons, sidebar links, and responsive checks at 375, 768 and 1280 px

### 9. Evals, Metrics and Triage for any specialist (R6, R7)
- [x] 9.1 Add the picker to the three pages and keep the choice in links between them
- [x] 9.2 Evals: choose the instance (and "all instances" for built-in versions) when running; imported specialists show an Import outputs link instead; the verdict page shows expected and actual for each field generically and names the instance
- [x] 9.3 Metrics and Triage: say which instances are being considered, and on a failure mode say which instance's run reopened it and which instances each scenario fails on
- [x] 9.4 Update the audit script to cover the picker with at least two specialists

### 10. The onboarding checklist and the adoption metric (R8, R9)
- [x] 10.1 Create `src/lib/evals/onboarding.ts` with pure functions: checklist step status from a specialist's data (minimums as named constants: at least 6 scenarios and at least 2 hold-out), `isAssisted` (an admin other than the owner acted before the first verified fix, from the activity log, run actors and fix events), `computeAdoption` (specialists, with a verdict, fully onboarded, unassisted share, median time from creation to first verdict)
- [x] 10.2 Tests for each step in each state, for assistance by admin owner versus admin non-owner versus staff, for acting after the first verified fix not counting, and for adoption on empty, one and several specialists, including the median
- [x] 10.3 `/dashboard/onboarding`: the checklist for the chosen specialist with a short instruction per step and a link to the playbook, resumable because it reads real data
- [x] 10.4 An Adoption section on the Metrics page, across all specialists, that says how many are sample

### 11. Seed data (R11)
- [x] 11.1 Seed the three instances (standard clinic reading the live catalogue; a short-staffed clinic missing Human Expectation Recalibration; a regional catalogue with renamed therapies), and seed the intake-triage example as the first specialist through the real create path, with its existing runs and sample history on the standard instance only
- [x] 11.2 Create three sample specialists through the real create and import path from the classification template, with deterministic outputs and invented timings and activity (flagged sample), so the adoption metric shows both an unassisted and an assisted team and one that is still in progress
- [x] 11.3 Share the sample definitions in one module with a comment that they are invented, and test that the real rules produce the documented adoption numbers
- [x] 11.4 Confirm the seeded numbers in `validation.md`, including that every Phase 7 to 9 figure is unchanged

### 12. Playbook and docs (R10)
- [x] 12.1 Write `docs/playbook.md`: choose a template, write good scenarios (splits, themes, weights), define fields and checks, import the config, export outputs from your specialist, import them with a version and a release time, read a verdict (thresholds, hold-out, overfitting), triage (score, effort, fixes, owners), verify with a re-run, and use instances; plus a troubleshooting list of the common validation errors
- [x] 12.2 Update the README (Phase 10 built, the playbook, how to onboard a specialist, re-seeding after migrating), the strategy doc status, the follow-ups, the roadmap and the changelog

### 13. Quality pass (R13, R14)
- [x] 13.1 `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` all clean; note first-load JS for the new routes
- [x] 13.2 Run the audit script (all pages, and the triage and new pages filtered) at 375, 768 and 1280 px and resolve every violation, in lighter runs if memory is tight
- [x] 13.3 Walk the manual flows in `validation.md` in a browser, including onboarding a specialist from a template to a verified fix, and the instance spread _(scripted in headless Chrome, not by hand: see the results in `validation.md`)_
- [x] 13.4 Mark Phase 10 `✓ Complete` in `specs/roadmap.md` _(marked on the branch; the merge to `main` is still to do)_
