# AgentClinic

**A worked example of self-serve hill climbing for AI Specialists**, built on a clinic domain where AI agents present ailments, receive therapies, and book appointments.

The clinic is the environment under test. The product thinking is in how to run the improvement loop (test, find failures, prioritize fixes, ship, re-test) faster and without a central team in the room. Read the strategy: [`specs/strategy.md`](specs/strategy.md).

## Screenshots

| Staff dashboard | Notifications (unread badge in nav) |
|---|---|
| ![Staff dashboard](docs/screenshots/staff-dashboard.png) | ![Notifications](docs/screenshots/notifications.png) |

| Metrics: pass rate across versions (the loop times shown are illustrative sample data) |
|---|
| ![Metrics page with the pass-rate chart and per-version table](docs/screenshots/metrics.png) |

## What's here

| Area | Status | Where |
|---|---|---|
| Clinic app: auth, roles, agents, ailments, therapies, appointment booking, staff dashboard, discharge, in-app notifications | Built (Phases 1–6) | `src/`, `prisma/` |
| Eval harness and quality verdicts: a versioned Intake Triage specialist, 32 golden scenarios with a hold-out set, deterministic checks, an optional LLM judge, and a PASS/FAIL verdict with version comparison | Built (Phase 7) | `src/lib/evals/`, `scripts/eval.ts`, `/dashboard/evals` |
| Loop-time and quality metrics: change, start and verdict timestamps on every run; median loop time against a target; pass rate per version; scenarios fixed and regressions detected; a hill-climbing chart | Built (Phase 8) | `src/lib/evals/metrics.ts`, `/dashboard/metrics` |
| Failure triage to ranked fix backlog | Planned (Phase 9) | `specs/strategy.md` |
| Self-serve onboarding and playbook | Planned (Phase 10) | `specs/strategy.md` |

Phases 9 and 10 are planned: they are proposals and are not implemented yet.

## How the clinic maps to the loop

| Clinic | Hill climbing |
|---|---|
| Ailment | Failure mode found in eval |
| Triage / diagnosis | Error analysis |
| Therapy | Prioritized fix |
| Appointment | Scheduled eval run / fix slot |
| Discharge | Fix verified, regression-gated |
| Treatment history | Quality trend across versions |

## Product artifacts

- [`specs/strategy.md`](specs/strategy.md): problem, personas, metrics, scope, roadmap rationale, scale path, customer-instance program, risks.
- [`specs/mission.md`](specs/mission.md): original product mission.
- [`specs/roadmap.md`](specs/roadmap.md): phase-by-phase delivery plan and status.
- [`specs/follow-ups.md`](specs/follow-ups.md): known issues and deferred work.
- [`specs/tech-stack.md`](specs/tech-stack.md): stack and conventions.
- [`prompts.md`](prompts.md) and [`CHANGELOG.md`](CHANGELOG.md): how the project was built with an AI coding agent using spec-driven development.

## Run locally

Requires Node.js 18+.

```bash
npm install
cp .env.local.example .env.local   # then set AUTH_SECRET
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Open http://localhost:3000. Run tests with `npm test`.

## Run the evals

The seed creates one real run of each specialist version, so `/dashboard/evals` (staff and admin) is populated on a fresh install.

```bash
npm run eval                      # every version, in release order
npm run eval -- --version v2      # one version
npm run eval -- --judge           # also score rationales with the LLM judge (needs ANTHROPIC_API_KEY)
```

`v1` is a baseline with known gaps and returns FAIL (exit code 1); `v2` fixes most of them and returns PASS. A run passes when the dev pass rate is at least 85% and the hold-out rate is within 10 points of dev. The LLM judge is optional and off by default; everything else runs with no API key or network.

## Metrics

`/dashboard/metrics` (staff and admin) shows how quickly a shipped change gets a verdict and how quality moves between versions: median loop time against a 3-day target, the baseline and latest loop times, pass rate per version, scenarios fixed and regressions detected, and a chart of dev and hold-out pass rate across versions. A median loop time tile is also on the staff dashboard.

**The seeded timings are illustrative sample data.** To make a fresh install show a weeks-to-days story, the seed records `v1` as taking 21 days to get a verdict and `v2` as taking 2. Those times were invented. The scenario results, pass rates and comparisons on those runs are real, because they come from running the harness. Sample runs are flagged `isSample` and labelled wherever they appear, and any run you start yourself is real and is never flagged.
## Accessibility and responsive audit

With the app running on port 3100 and the database seeded (`npm run build`, then `AUTH_TRUST_HOST=true npm start -- -p 3100`), `npm run audit` signs in as each role and checks every page at 375, 768 and 1280 px for horizontal overflow and WCAG 2.1 A/AA violations (axe-core). It also confirms agents cannot open the evals pages. Needs Chrome.

## Stack

Next.js 14 (App Router), TypeScript (strict), Prisma + SQLite, Auth.js, PicoCSS, Vitest. Runs fully locally with no external services.

## Original stakeholder input

- Mary in engineering wants a reliable site with a popular stack based on TypeScript, giving agents and staff a dashboard for easy access.
- Susan in product has a set of features about agents and their ailments, therapies, and booking appointments.
- Steve in marketing wants an attractive site that works well with a modern browser.
