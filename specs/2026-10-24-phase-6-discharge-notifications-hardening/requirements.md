# Phase 6 — Discharge, In-App Notifications & Hardening: Requirements

## Scope

### In
- **R1 Ailment discharge**: staff/admin can discharge an ailment with a required note; staff/admin can reopen it. Discharge cancels outstanding appointments for that ailment.
- **R2 Treatment history**: agents and staff see a per-ailment history from intake to discharge.
- **R3 In-app notifications**: a `Notification` table, created on appointment booked, confirmed, cancelled, and on discharge; unread badge in the nav; a notifications page with mark-as-read.
- **R4 Test and role-guard hardening**: new Vitest coverage for discharge, notifications, and authorization guards.
- **R5 Quality pass**: lint clean, axe-cli across all key pages, type check and build clean.
- **R6 Responsive and accessible**: all new UI works at 375 / 768 / 1280 px with no horizontal scroll.

### Out
- Real email delivery (Resend or any provider). Phase 4 marked it optional and it was never built; it is deferred to a later phase.
- Push or real-time notifications (polling, websockets).
- Notification preferences, deletion, or digests.
- New roles, user management changes, Postgres migration, or deployment changes.

## Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Email confirmations | Replaced by in-app notifications; no external service | Tech stack and mission target fully local use for students and demos; no secrets or API keys needed |
| Discharge model | Reuse existing `RESOLVED` status plus `dischargedAt`/`dischargeNote` columns; no separate table | Smallest change; status enum already exists; one migration |
| Reopen | Allowed for staff/admin | Discharge mistakes are likely; avoids needing direct DB edits |
| Notification delivery | Rows written by lib functions in the same server action; shown on page load (no polling) | Matches the "server components + server actions" constraint |
| Phase size | Medium, one migration | Staff and agents both benefit; keeps the app working after each task group |

## Context

- **Users affected**: agents (see notifications and history of their own ailments), staff (discharge, receive booking notifications), admins (same as staff).
- **Dependencies**: Phase 2 ailments, Phase 3 therapy assignment (`assignTherapy` sets `IN_TREATMENT`), Phase 4 appointments (`createAppointment`, `cancelAppointment` in `src/lib/appointments.ts`), Phase 5 `EmptyState` and `loading.tsx` skeleton pattern.
- **Constraints** (from `specs/tech-stack.md`): Prisma only, no raw SQL; no client data-fetching libraries; PicoCSS with overrides in `globals.css`; strict TypeScript; `prisma/dev.db` not committed; responsive at 375 / 768 / 1280 px.
- **Mission fit**: Recovery ("tracked from intake through to discharge") and Discretion (notifications and history are visible only to the owning agent and to staff/admin).
- **Risks**: failing notification writes breaking bookings (see 4.3); discharge cancelling appointments needs a transaction; the nav badge could crowd the mobile nav.
