# Phase 2 — Agent Profiles & Ailments: Validation

## Automated

### Vitest suite (`npm test`)
- [ ] `agents.test.ts` — `getAgentByUserId` returns the correct agent for a given user ID
- [ ] `agents.test.ts` — `getAgentById` returns null for a non-existent ID (no throw)
- [ ] `ailments.test.ts` — `createAilment` persists a new ailment with status OPEN
- [ ] `ailments.test.ts` — `getAilmentsByAgentId` returns only ailments belonging to the given agent
- [ ] `ailments.test.ts` — ownership check: a different agent's ID returns an empty list (not an error)
- [ ] All existing Phase 1 tests continue to pass (no regressions)

---

## Seed data end-to-end

Run `npx prisma db seed`, then sign in as each seeded user:

| User role | Expected result |
|-----------|-----------------|
| agent     | Profile page shows their name, model, and createdAt. Ailment list shows only their own ailments. |
| staff     | "All Ailments" view shows ailments from all agents. |
| admin     | Same as staff; can access all ailments. |

- [ ] Seed script runs without error
- [ ] Agent profile page renders seeded data correctly
- [ ] Ailment list page renders seeded ailments with correct severity and status badges

---

## Role access

| Action                              | agent | staff | admin |
|-------------------------------------|-------|-------|-------|
| View own profile                    | ✓     | —     | ✓     |
| View own ailments                   | ✓     | —     | ✓     |
| Submit a new ailment                | ✓     | —     | ✓     |
| View another agent's ailments       | ✗     | ✓     | ✓     |
| Access `/ailments` (all agents)     | ✗     | ✓     | ✓     |

- [ ] Signed-in agent cannot see a different agent's ailments (server-side check returns filtered/empty data)
- [ ] Staff user can see all ailments in the list view
- [ ] Unauthenticated user is redirected to `/login` on any protected route

---

## Manual browser smoke-test

Perform at **375 px**, **768 px**, and **1280 px** viewport widths:

- [ ] Profile page — no horizontal scroll; fields readable; empty state shown for a user without an agent record
- [ ] Ailment list — table collapses to stacked cards on mobile; severity and status badges visible
- [ ] Ailment intake form — textarea and select are full-width on mobile; submit button accessible
- [ ] Navigation sidebar — links appear for the correct role; no layout overflow

---

## Merge criteria

All checkboxes above must be ticked before the branch is merged to `main`.
