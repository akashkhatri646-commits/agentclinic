# Phase 4 — Appointment Booking: Requirements

## Scope

Agents can book a session for a therapy that has been assigned to their ailment. Staff have a calendar view of upcoming appointments. No external email service is required — the system is fully local.

---

## Data Model

### `appointments` table
| Column      | Type     | Notes                                                  |
|-------------|----------|--------------------------------------------------------|
| id          | String   | cuid, primary key                                      |
| agentId     | String   | FK → Agent                                             |
| staffId     | String   | FK → User (the staff member running the session)       |
| ailmentId   | String   | FK → Ailment                                           |
| therapyId   | String   | FK → Therapy                                           |
| scheduledAt | DateTime | The chosen slot start time                             |
| status      | Enum     | PENDING \| CONFIRMED \| CANCELLED                      |
| createdAt   | DateTime | auto-set on insert                                     |

### Availability model

Staff availability is **not** stored in the database. Available slots are derived at runtime: any 1-hour block between 09:00 and 17:00 on working days (Mon–Fri) that does not already have a `CONFIRMED` or `PENDING` appointment for that staff member is available.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Fixed 1-hour slots, Mon–Fri 09:00–17:00** | Zero-config; no staff availability management screen needed. Keeps the phase local-only with no external services. |
| 2 | **No email confirmation** | Keeps the phase zero-external-services; Resend integration is explicitly deferred. |
| 3 | Agent books from the **ailment detail page** | Contextual flow: agent sees their assigned therapy and books directly from there. |
| 4 | Booking status defaults to **PENDING** | Staff confirm or cancel from the calendar view; auto-confirm can be added later. |
| 5 | An ailment can have **at most one non-cancelled appointment** | Prevents duplicate bookings; agent must cancel before rebooking. |
| 6 | Staff calendar shows **one week at a time** with prev/next navigation | Simple and implementable without a full calendar library. |
| 7 | Cancellation is available to both the **agent and staff** | Agents can cancel their own; staff can cancel any. |
| 8 | Seed script adds 2–3 sample appointments | Calendar view is explorable after `npx prisma db seed`. |

---

## Out of Scope (Phase 4)

- Email or push notifications (Phase 5 / future)
- Recurring appointments
- Staff-configurable availability windows
- Waiting list / overbooking logic
