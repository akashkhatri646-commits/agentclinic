# Phase 6 — Discharge, In-App Notifications & Hardening: Validation

## Commands that must pass
- [ ] `npx prisma migrate status` reports the database up to date; `npx prisma generate` succeeds
- [ ] `npm test` — all tests pass, none skipped (existing 42 plus new discharge, notifications, and guard tests) (R1, R3, R4)
- [ ] `npx tsc --noEmit` — no errors
- [ ] `npm run lint` — no errors or warnings (R5)
- [ ] `npm run build` — succeeds; new routes' first-load JS noted and under 250 kB

## Manual flows

### Agent
- [ ] Submit an ailment, get a therapy assigned, book an appointment: a notification appears and the nav badge count increases (R3)
- [ ] Notifications page shows only this agent's notifications; opening a link goes to the right ailment; mark one/all as read lowers the badge (R3)
- [ ] After discharge, the ailment shows as RESOLVED with the discharge date, the note, and a full treatment history; no Discharge or Reopen controls are visible (R1, R2)
- [ ] Visiting a discharge action or another user's notification directly is rejected (R4)

### Staff
- [ ] Booking by an agent notifies the assigned staff member (R3)
- [ ] Discharge an IN_TREATMENT ailment with a note: status becomes RESOLVED, future appointments become CANCELLED, the agent is notified (R1, R3)
- [ ] Discharge with an empty note is refused with a visible error (R1)
- [ ] Reopen a resolved ailment: status returns to IN_TREATMENT (therapy assigned) or OPEN; discharge fields cleared (R1)
- [ ] Confirm and cancel from the calendar notify the agent (R3)

### Admin
- [ ] Same discharge and reopen capability as staff; notifications page works; admin users page still works (R1, R3)

## Responsive checks (375, 768, 1280 px — no horizontal scroll) (R6)
- [ ] Ailment detail with discharge form and history
- [ ] Ailment list with resolved grouping/filter
- [ ] Notifications page, including empty state and loading skeleton
- [ ] NavBar with unread badge, including a two-digit count at 375 px

## Accessibility (R5, R6)
- [ ] `npx axe-cli` reports 0 violations on login, dashboard, ailments list, ailment detail, appointments, therapies, notifications, admin users
- [ ] Unread badge has an accessible name (e.g. "Notifications, 3 unread"); read/unread state is not conveyed by colour alone
- [ ] Discharge and reopen forms are keyboard operable with visible labels and focus rings
- [ ] Heading order stays h1 → h2 → h3

## Traceability
| Requirement | Plan groups | Checks |
|---|---|---|
| R1 | 1, 2, 3 | tests, staff and admin flows |
| R2 | 3 | agent flow, responsive |
| R3 | 1, 4, 5 | tests, all role flows |
| R4 | 4, 6 | `npm test`, direct-access checks |
| R5 | 7 | lint, axe, tsc, build |
| R6 | 3, 5 | responsive and accessibility sections |

## Merge checklist
- [ ] All commands above pass on the branch `phase-6-discharge-notifications-hardening`
- [ ] New migration committed; `init_all` migration untouched; `prisma/dev.db` not committed
- [ ] Manual flows for agent, staff, and admin walked through
- [ ] Responsive and axe checks done
- [ ] `CHANGELOG.md` updated; Phase 6 marked `✓ Complete` in `specs/roadmap.md`
