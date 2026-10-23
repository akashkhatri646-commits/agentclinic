# Phase 2 — Agent Profiles & Ailments: Requirements

## Scope

Agents can exist as named entities in the system, and they can log the ailments troubling them. Staff can see all agents and ailments. No therapy assignment or booking yet — that is Phase 3.

---

## Data Model

### `agents` table
| Column        | Type     | Notes                                      |
|---------------|----------|--------------------------------------------|
| id            | String   | cuid, primary key                          |
| name          | String   | Display name of the agent                  |
| model         | String   | e.g. "claude-sonnet-4-6", "gpt-4o"         |
| ownerNotes    | String?  | Free-text notes from the clinic (optional) |
| createdAt     | DateTime | auto-set on insert                         |
| userId        | String   | FK → User (Auth.js session owner)          |

One `User` may own at most one `Agent` profile (1-to-1).

### `ailments` table
| Column      | Type     | Notes                                           |
|-------------|----------|-------------------------------------------------|
| id          | String   | cuid, primary key                               |
| agentId     | String   | FK → Agent                                      |
| description | String   | Free-text description of the ailment            |
| severity    | Enum     | LOW \| MEDIUM \| HIGH                           |
| status      | Enum     | OPEN \| IN_TREATMENT \| RESOLVED                |
| createdAt   | DateTime | auto-set on insert                              |

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Agent profile is **read-only** for the agent | Admins control agent records; agents cannot edit their own profile fields. Only admins can update name, model, or notes. |
| 2 | Severity uses **Low / Medium / High** (3-tier enum) | Simpler than 5-point scale; maps cleanly to PicoCSS semantic colour variables (`--pico-color-green`, `--pico-color-amber`, `--pico-color-red`) for badge styling. |
| 3 | Ailment status defaults to **OPEN** on creation | Agents submit ailments; status progression is managed by staff in later phases. |
| 4 | An agent can only see **their own** ailments | Enforced server-side; staff/admin can see all. |
| 5 | No editing ailments once submitted (Phase 2) | Simplifies state; editing can be added in a later phase if needed. |
| 6 | Seed script adds sample agents and ailments | Required by validation criteria so the UI is explorable without manual data entry. |

---

## Out of Scope (Phase 2)

- Therapy assignment (Phase 3)
- Appointment booking (Phase 4)
- Agent-editable profile fields
- Pagination or search on the ailment list
