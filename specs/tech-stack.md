# Tech Stack

## Overview

AgentClinic is built on a modern, TypeScript-first stack optimised for developer experience, reliability, and a polished browser experience. It is designed to run entirely locally with no external cloud services required — making it ideal for course students and conference demos.

## Stack

| Layer      | Technology                          | Rationale                                                    |
|------------|-------------------------------------|--------------------------------------------------------------|
| Framework  | [Next.js](https://nextjs.org) 14+   | App Router, SSR/SSG, API routes — all in one TypeScript repo |
| Language   | TypeScript (strict)                 | End-to-end type safety across front and back end             |
| Styling    | PicoCSS                             | Classless semantic CSS; minimal markup, built-in responsive grid, clean clinical aesthetic out of the box |
| Database   | SQLite (via Prisma)                 | Zero-config, file-based, no external service needed          |
| Auth       | Auth.js (NextAuth)                  | Credential + OAuth support; works with any database adapter  |
| Backend    | Next.js API routes                  | Serverless-compatible functions co-located with the frontend |
| Testing    | Vitest                              | Fast, TypeScript-native unit and integration tests           |
| Validation | Hand-written validators         | The specialist and outputs formats are checked by pure functions with fixed error codes (`src/lib/evals/spec.ts`, `outputs.ts`) |
| LLM judge  | Anthropic SDK + Zod (`claude-haiku-5-5`) | Optional. Scores one free-text field in an eval run (Zod shapes its structured reply); every run works without it |
| Scripts    | ts-node                             | Command-line eval runner, database upgrade and seed          |
| Audit      | axe-cli + headless Chrome           | `npm run audit` walks every page as each role                |
| Deployment | Local first (`npm run build`, `npm start`) | No hosting is set up. SQLite is a local file, so a serverless host such as Vercel would need a hosted database first |

## Configuration

Set in `.env.local` (copy `.env.local.example`). Names only here; never commit values.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | SQLite file path for Prisma |
| `AUTH_SECRET` | yes | Signs Auth.js sessions |
| `AUTH_TRUST_HOST` | for `next start` | Set to `true` when running the production build locally; `npm run dev` does not need it |
| `ANTHROPIC_API_KEY` | no | Turns on the LLM judge (`npm run eval -- --judge`). Without it, `--judge` is ignored with a notice |
| `AUDIT_BASE`, `AUDIT_OUT`, `AUDIT_ONLY` | no | Only for `npm run audit`: base URL, report file, and one path to check |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Run the app |
| `npm test` | Vitest unit and integration tests |
| `npm run lint` | ESLint |
| `npm run eval` | Run a specialist version against its scenarios from the command line (`--specialist`, `--instance`, `--judge`) |
| `npm run db:upgrade` | Bring an existing database up to date after `prisma migrate deploy`; safe to run again |
| `npm run audit` | Accessibility and permission walk; needs the app on port 3100 with the seeded database |

## Conventions

- **`/src/app`** — Next.js App Router pages and layouts.
- **`/src/components`** — Shared React components.
- **`/src/lib`** — Prisma client, Auth.js config, and server helpers.
- **`/src/types`** — Shared TypeScript types and Prisma-generated database types.
- **`/src/tests`** — Vitest test files; run with `npm test`.
- Strict TypeScript (`"strict": true`) enforced via `tsconfig.json`.
- PicoCSS imported globally in `src/app/layout.tsx`; override CSS custom properties (e.g. `--pico-primary`) in `src/app/globals.css` for clinic-themed colours.

## Key Constraints

- No client-side data fetching libraries until justified by complexity (start with server components + server actions).
- All database access goes through the Prisma client — no raw SQL in components.
- The SQLite database file (`prisma/dev.db`) is local only and must not be committed to version control.
- Environment variables follow the `NEXT_PUBLIC_` convention for client-safe values; secrets (e.g. `AUTH_SECRET`) stay server-side only.
- **Responsive design is required on all pages.** Every page must render correctly at the standard breakpoints: 375 px (mobile), 768 px (tablet), 1280 px (desktop). Use PicoCSS's built-in responsive grid (`<div class="grid">`, container queries) and standard `@media` queries for any custom overrides; avoid fixed widths that break at small viewports. No horizontal scroll at any breakpoint.

## Errors and consistency

- **Fixed messages.** Server actions return an error code that a fixed map turns into a message, so a failure never shows raw database or validation text.
- **Permissions are checked twice.** Pages redirect by role, and every server action checks the session and role again.
- **Bookkeeping fails soft.** Event logging and other side records must not turn a successful action into a failed one.
- **The harness never runs team code.** Teams import outputs in a defined format; the harness only grades them. Nothing is executed and nothing calls out except the optional judge.
- **SQLite has no list or JSON column in this Prisma version,** so lists are stored as JSON text and validated when read.
- **Concurrency.** SQLite serialises writes, which is enough for one team. Two known races (importing the same new version label at once, and an edit racing a first import) are logged in `specs/follow-ups.md` with a suggested fix.
- **Dates are UTC** everywhere they are stored, compared or shown.
