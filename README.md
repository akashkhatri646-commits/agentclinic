# AgentClinic

**A worked example of self-serve hill climbing for AI Specialists**, built on a clinic domain where AI agents present ailments, receive therapies, and book appointments.

The clinic is the environment under test. The product thinking is in how to run the improvement loop (test, find failures, prioritize fixes, ship, re-test) faster and without a central team in the room. Read the strategy: [`specs/strategy.md`](specs/strategy.md).

## What's here

| Area | Status | Where |
|---|---|---|
| Clinic app: auth, roles, agents, ailments, therapies, appointment booking, staff dashboard, discharge, in-app notifications | Built (Phases 1–6) | `src/`, `prisma/` |
| Eval harness and quality verdicts | Planned (Phase 7) | `specs/strategy.md` |
| Loop-time and quality metrics | Planned (Phase 8) | `specs/strategy.md` |
| Failure triage to ranked fix backlog | Planned (Phase 9) | `specs/strategy.md` |
| Self-serve onboarding and playbook | Planned (Phase 10) | `specs/strategy.md` |

Planned phases are proposals and are not implemented yet.

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

## Stack

Next.js 14 (App Router), TypeScript (strict), Prisma + SQLite, Auth.js, PicoCSS, Vitest. Runs fully locally with no external services.

## Original stakeholder input

- Mary in engineering wants a reliable site with a popular stack based on TypeScript, giving agents and staff a dashboard for easy access.
- Susan in product has a set of features about agents and their ailments, therapies, and booking appointments.
- Steve in marketing wants an attractive site that works well with a modern browser.
