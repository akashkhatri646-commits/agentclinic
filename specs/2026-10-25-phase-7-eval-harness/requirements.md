# Phase 7 — Eval Harness & Quality Verdicts: Requirements

## Scope

### In
- **R1 Demo specialist with versions**: an "Intake Triage" AI Specialist that takes an ailment description and the clinic's therapy catalogue and returns a severity (`LOW`/`MEDIUM`/`HIGH`), a recommended therapy, and a short rationale. Two versions ship: `v1` (baseline with known gaps) and `v2` (improved). Each version has a versioned config (id, version, summary of what changed).
- **R2 Golden scenarios with a hold-out**: about 32 scenarios stored in the repo (24 `DEV`, 8 `HOLDOUT`), each with an input description and expected severity and therapy.
- **R3 Runner with persisted results**: a runner executes every scenario for a chosen specialist version against the live clinic environment (it loads the current therapy catalogue from the database) and records an `EvalRun` plus one `EvalResult` per scenario.
- **R4 Deterministic checks**: severity matches, therapy matches, recommended therapy exists in the live catalogue, rationale is non-empty. Every failed result carries a category and a human-readable reason.
- **R5 Optional LLM judge**: scores whether the rationale is grounded in the description. Implemented with the Anthropic SDK, runs only when `ANTHROPIC_API_KEY` is set, injectable so tests use a fake. Off by default; the whole feature works without it.
- **R6 Verdict and comparison**: each run gets a `PASS`/`FAIL` verdict with a stated reason, using the dev pass rate and a hold-out gap check. The verdict page shows pass rates, failures by category, the failed scenarios, and a comparison with the previous version (delta, scenarios fixed, scenarios regressed).
- **R7 Three ways to see it**: a staff/admin eval page (list runs, start a run, view a verdict), a CLI (`npm run eval`) that uses the same library code, and seed data containing one real `v1` run and one real `v2` run so a fresh install is not empty.
- **R8 Access control and hardening**: staff and admin only, enforced on the pages and again inside the server action.
- **R9 Quality, responsive, accessible**: new Vitest coverage, lint/type/build clean, axe clean, no horizontal scroll at 375 / 768 / 1280 px.

### Out
- Loop-time and change-to-verdict timing metrics, trend charts (Phase 8).
- Failure clustering, priority scoring, fix backlog (Phase 9).
- Bring-your-own specialist, scenario authoring in the UI, multiple customer instances (Phase 10).
- A real LLM as the specialist under test.
- Scheduled or background runs, run deletion, run cancellation.
- Driving the browser UI as part of a scenario. "Against the clinic environment" means using the live database (therapy catalogue), not UI automation.

## Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Scope of the roadmap bullets | Everything, with the LLM judge off by default | Delivers the full story from the roadmap; the app still runs with no external service or key |
| Specialist task | Intake triage: severity plus therapy recommendation | Fits the clinic domain; two independently checkable fields give Phase 9 distinct failure categories to work with |
| Specialist implementation | Deterministic, rule-based, versioned pure functions | Reproducible and testable; `v1` vs `v2` differences come from the harness and fixtures, not model variance; consistent with "no external services" |
| Versions shipped | `v1` baseline, `v2` improved | Demonstrates one full hill-climbing step (find failures, fix, re-test) with real recorded runs |
| Storage | Database tables `EvalRun` and `EvalResult` via Prisma | Phase 8 needs timestamps and per-version history; consistent with the Prisma-only rule |
| Scenario references | Therapies referenced by name, not id | Therapy ids differ between databases; names are stable in the seed catalogue. A therapy missing from the catalogue fails with a clear reason, which is itself a useful environment check |
| LLM judge target | Rationale quality only (grounded in the description), 1–5 score, pass at 3 or above | The deterministic checks already cover severity and therapy; judging them again would be redundant and cost more |
| LLM judge failures | Non-fatal. An API error leaves the judge result empty with a note; only a returned low score adds a failure | A flaky network must never turn a good run into a failed one |
| LLM judge SDK and model | `@anthropic-ai/sdk`, `claude-haiku-5-5`, imported lazily | Cheap and fast for scoring; lazy import keeps the SDK out of tests and builds that never use it. Consult the `claude-api` skill when implementing |
| Judge scope | Only scenarios that already passed the deterministic checks | Failed scenarios already have a reason; saves calls |
| Run trigger | UI button and CLI sharing one library | UI for staff and the demo; CLI for terminals and a future CI check |
| Verdict rule | `PASS` when dev pass rate is at least 85% and hold-out rate is within 10 points of dev; otherwise `FAIL` with the reason | The hold-out check detects overfitting to the dev set. Thresholds are named constants |
| Scenario count | About 32: 24 dev, 8 hold-out | Enough variety for `v1` to miss a believable handful while staying reviewable by hand |
| Access | Staff and admin only | Agents are the "patients" and should not see scenarios or the hold-out set; reuses `isStaff` |
| Seed data | Seed one real `v1` run and one real `v2` run by calling the runner from `prisma/seed.ts` | Genuine data, comparison view works on a fresh install; no hand-faked rows |
| Runner database access | The runner accepts an optional database client, defaulting to the shared one | Lets the seed script and tests supply their own client and avoids a second open connection in the seed process |
| Imports inside `src/lib/evals` | Relative imports, no `@/` alias | The CLI and seed run under `ts-node`, which does not resolve the alias; existing `src/lib` files already use relative imports |

## Context

- **Users affected**: staff and admin (view runs, start runs, read verdicts). Agents are unaffected and cannot reach the pages.
- **Dependencies**: the therapy catalogue and seed data (Phase 3), role guards and server-action pattern (Phases 5–6, `src/lib/guards.ts`), the `EmptyState` and `loading.tsx` skeleton patterns, and the sidebar navigation. Builds on the strategy in `specs/strategy.md`: this phase provides the "trustworthy verdict" that Phases 8 and 9 depend on.
- **Constraints** (from `specs/tech-stack.md`): Prisma only, no raw SQL; server components and server actions, no client data-fetching library; PicoCSS with overrides in `globals.css`; strict TypeScript; `prisma/dev.db` not committed; responsive at 375 / 768 / 1280 px with no horizontal scroll; runs locally with no required external service.
- **Mission fit**: serves the platform-team audience added to the mission and the strategy doc's north-star ("change to clear verdict"); keeps the clinic voice (ailments, therapies) so the domain mapping stays coherent.
- **Risks**:
  - A hand-written scenario set can overfit the rules (mitigated by the hold-out and its gap check).
  - Expected answers are subjective for borderline descriptions; scenarios need a one-line rationale each so reviewers can challenge them.
  - The judge adds cost and non-determinism; it is opt-in and excluded from the pass/fail tests.
  - Two simultaneous runs are not prevented (each is an independent row); acceptable for a local demo.
  - Importing the SDK in a server module could bloat client bundles if it leaks; verify first-load JS in the build.
- **Open questions for later phases**: whether scenario sets move to the database for editing (Phase 10), and how run timing is captured for loop-time metrics (Phase 8, which will add timestamps to the run lifecycle).
