# Phase 3 — Therapy Types & Assignment: Requirements

## Scope

Staff can define the therapies the clinic offers and assign them to agent ailments. Agents can see which therapy has been assigned to their ailment. No booking yet — that is Phase 4.

---

## Data Model

### `therapies` table
| Column           | Type     | Notes                                       |
|------------------|----------|---------------------------------------------|
| id               | String   | cuid, primary key                           |
| name             | String   | Short display name (e.g. "Prompt Detox")    |
| description      | String   | Full description of the therapy             |
| durationMinutes  | Int      | Session length in minutes                   |
| createdAt        | DateTime | auto-set on insert                          |

### `ailments` table (extension)
| Column     | Type    | Notes                                        |
|------------|---------|----------------------------------------------|
| therapyId  | String? | FK → Therapy; nullable until staff assigns   |

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Staff (and admin) can **create, edit, and delete** therapy types | Matches the roadmap spec; therapies should be manageable without a code deploy. |
| 2 | Therapy deletion is **hard delete** if no ailments reference it; **blocked** if in use | Prevents orphaned FK references; gives staff a clear error rather than silent data loss. |
| 3 | Assignment is a **staff-only action** on the ailment detail page | Agents cannot self-assign therapy; clinical decisions belong to staff. |
| 4 | One ailment can have **at most one** assigned therapy at a time | Keeps the model simple; reassignment overwrites the previous value. |
| 5 | Assigning a therapy sets ailment status to **IN_TREATMENT** | Automatic status progression; staff do not need a separate status update step. |
| 6 | Seed script adds 3–5 sample therapy types | UI is explorable immediately after `npx prisma db seed`. |

---

## Out of Scope (Phase 3)

- Appointment booking (Phase 4)
- Therapy history / audit log
- Agent-requested therapy preferences
- Pagination or search on the therapy list
