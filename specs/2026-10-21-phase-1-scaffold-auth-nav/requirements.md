# Requirements — Phase 1: Project Scaffold, Auth & Navigation

## Scope

Stand up a working Next.js application that any team member can clone, install, and run locally with a single set of commands. The app must have a public home page, handle sign-in and sign-out, and enforce role-based route protection on `/dashboard`. No feature data (agents, ailments, therapies) is introduced in this phase.

## Stakeholder alignment

| Stakeholder | Requirement | How Phase 1 addresses it |
|-------------|-------------|--------------------------|
| Mary (engineering) | Reliable TypeScript stack, popular framework | Next.js 14 + strict TypeScript + Tailwind + Vitest |
| Mary (engineering) | Dashboard shell ready for Phase 2 | Protected `/dashboard` layout with nav + sidebar placeholders |
| Steve (marketing) | Attractive site, modern browser, responsive | Public home page with clinic name, tagline, and Sign In CTA; Tailwind responsive at 375 px |
| Susan (product) | Role model in place before feature work | `Role` enum (`AGENT`, `STAFF`, `ADMIN`) on `User` model |

## Key decisions

**Prisma + SQLite over Supabase**
Local-first design — no cloud account, no internet required. This directly serves course students running the project for the first time and developers demoing at conference booths. SQLite file lives at `prisma/dev.db` and is never committed.

**Auth.js credentials provider (email + password)**
Simplest auth flow for a local-first app. OAuth providers (GitHub, Google) are deferred to a later phase when deployment to a live environment is prioritised.

**Role stored as an enum on `User`, not a join table**
Three fixed roles (`AGENT`, `STAFF`, `ADMIN`) are known up front and are unlikely to grow. A join table would add complexity with no current benefit.

**`AUTH_SECRET` in `.env.local` only**
Never committed. `.env.local.example` documents the variable name and format so new contributors know what to create.

**Vitest for unit tests**
Pure business logic (role checks, utility helpers) is extracted into standalone functions so it can be tested without mocking the database or the framework. Tests live in `src/tests/` and run with `npm test`.

## Non-goals for this phase

- No agent or ailment data models (Phase 2)
- No email sending or password reset flow
- No OAuth / social login
- No production database or migration strategy
- No deployment to Vercel (config only; actual deploy is optional and out of scope for the branch)
- No UI theming or design polish (Phase 5)
