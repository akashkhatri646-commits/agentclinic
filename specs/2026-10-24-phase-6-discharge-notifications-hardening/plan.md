# Phase 6 — Discharge, In-App Notifications & Hardening: Plan

## Task Groups

### 1. Schema & migration
1.1 Add `dischargedAt DateTime?` and `dischargeNote String?` to `Ailment` in `prisma/schema.prisma`
1.2 Add `Notification` model: id, userId (FK to User, cascade), message, href (optional), readAt (nullable), createdAt
1.3 Add `notifications Notification[]` relation to `User`
1.4 Create a new migration under `prisma/migrations/` (do not edit `20261024000000_init_all`); run `npx prisma generate`
1.5 Extend `prisma/seed.ts` with one discharged ailment and a few notifications so the UI has demo data

### 2. Ailment discharge (logic + tests)
2.1 Add `dischargeAilment(ailmentId, note)` to `src/lib/ailments.ts`: sets status `RESOLVED`, `dischargedAt`, `dischargeNote`; cancels any PENDING/CONFIRMED future appointments for the ailment; rejects already-resolved ailments and empty notes
2.2 Add `reopenAilment(ailmentId)`: sets status back to `OPEN` (or `IN_TREATMENT` if a therapy is assigned) and clears discharge fields
2.3 Tests in `src/tests/ailments.test.ts`: discharge happy path, double discharge rejected, empty note rejected, future appointments cancelled, reopen restores status

### 3. Discharge UI & treatment history
3.1 Add `dischargeAilmentAction` / `reopenAilmentAction` server actions in `src/app/dashboard/ailments/actions.ts`, guarded to staff/admin
3.2 Ailment detail page: staff-only "Discharge" form (note textarea) and "Reopen" button on resolved ailments
3.3 Ailment detail page: show a treatment history panel (intake date, therapy, appointments in order, discharge date and note) to both agent and staff
3.4 Ailment list: add status filter or grouping so RESOLVED ailments are visibly separate; add `EmptyState` where relevant
3.5 Check 375 / 768 / 1280 px

### 4. Notifications logic (+ tests)
4.1 Create `src/lib/notifications.ts`: `createNotification`, `getNotificationsForUser`, `getUnreadCount`, `markAsRead`, `markAllAsRead` (all scoped to the owning user)
4.2 Hook into `src/lib/appointments.ts`: booking notifies the staff member and agent; confirm notifies the agent; cancel notifies the other party; discharge (2.1) notifies the agent
4.3 Notification creation must never break the main action (wrap in the same transaction or fail soft; decide and document in code)
4.4 Tests in `src/tests/notifications.test.ts`: created on book/confirm/cancel/discharge, correct recipients, unread count, mark read only works for the owner

### 5. Notifications UI
5.1 `src/app/dashboard/notifications/page.tsx`: list newest first, unread highlighted, link to `href`, "Mark all as read" action, `EmptyState` and `loading.tsx` skeleton
5.2 Add `markNotificationReadAction` / `markAllReadAction` server actions
5.3 NavBar: unread count badge linking to the notifications page, with an `aria-label` such as "Notifications, 3 unread"; add the link to the sidebar
5.4 Check 375 / 768 / 1280 px; badge must not cause horizontal overflow in the mobile nav

### 6. Auth & role-guard hardening
6.1 Tests for `src/lib/roles.ts` edge cases and for server-action guards (agent cannot discharge, cannot read another user's notifications, cannot book for another agent's ailment)
6.2 Fix any guard gaps found, with a test that fails first
6.3 Review `src/middleware.ts` coverage of new routes (`/dashboard/notifications`)

### 7. Quality pass
7.1 Run `npm run lint` and fix all warnings and errors (configure ESLint via `next lint` if it prompts for setup)
7.2 Run `npx axe-cli` against the dev server for login, dashboard, ailments list, ailment detail, appointments, therapies, notifications, admin users; resolve all WCAG 2.1 AA violations
7.3 `npx tsc --noEmit`, `npm test`, `npm run build` all clean; note first-load JS for new routes
7.4 Update `CHANGELOG.md` via the update-changelog skill and tick off Phase 6 in `specs/roadmap.md` when merged
