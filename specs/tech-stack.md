# Tech Stack

## Overview

AgentClinic is built on a modern, TypeScript-first stack optimised for developer experience, reliability, and a polished browser experience. It is designed to run entirely locally with no external cloud services required — making it ideal for course students and conference demos.

## Stack

| Layer      | Technology                          | Rationale                                                    |
|------------|-------------------------------------|--------------------------------------------------------------|
| Framework  | [Next.js](https://nextjs.org) 14+   | App Router, SSR/SSG, API routes — all in one TypeScript repo |
| Language   | TypeScript (strict)                 | End-to-end type safety across front and back end             |
| Styling    | Tailwind CSS                        | Utility-first; fast to build attractive, responsive UIs      |
| Database   | SQLite (via Prisma)                 | Zero-config, file-based, no external service needed          |
| Auth       | Auth.js (NextAuth)                  | Credential + OAuth support; works with any database adapter  |
| Backend    | Next.js API routes                  | Serverless-compatible functions co-located with the frontend |
| Testing    | Vitest                              | Fast, TypeScript-native unit and integration tests           |
| Deployment | Vercel                              | Zero-config deploys, preview URLs, edge network              |

## Conventions

- **`/src/app`** — Next.js App Router pages and layouts.
- **`/src/components`** — Shared React components.
- **`/src/lib`** — Prisma client, Auth.js config, and server helpers.
- **`/src/types`** — Shared TypeScript types and Prisma-generated database types.
- **`/src/tests`** — Vitest test files; run with `npm test`.
- Strict TypeScript (`"strict": true`) enforced via `tsconfig.json`.
- Tailwind configured in `tailwind.config.ts` with a clinic-themed design token palette.

## Key Constraints

- No client-side data fetching libraries until justified by complexity (start with server components + server actions).
- All database access goes through the Prisma client — no raw SQL in components.
- The SQLite database file (`prisma/dev.db`) is local only and must not be committed to version control.
- Environment variables follow the `NEXT_PUBLIC_` convention for client-safe values; secrets (e.g. `AUTH_SECRET`) stay server-side only.
