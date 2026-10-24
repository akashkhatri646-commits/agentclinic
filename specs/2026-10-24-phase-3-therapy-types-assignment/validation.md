# Phase 3 — Therapy Types & Assignment: Validation

## Automated

### Vitest suite (`npm test`)
- [ ] `therapies.test.ts` — `createTherapy` persists a record with correct fields
- [ ] `therapies.test.ts` — `updateTherapy` changes only the specified fields
- [ ] `therapies.test.ts` — `deleteTherapy` throws when the therapy is referenced by an ailment
- [ ] `therapies.test.ts` — `deleteTherapy` succeeds when no ailments reference the therapy
- [ ] `ailments.test.ts` — `assignTherapy` sets `therapyId` on the ailment
- [ ] `ailments.test.ts` — `assignTherapy` updates ailment status to `IN_TREATMENT`
- [ ] All existing Phase 1 and Phase 2 tests continue to pass (no regressions)

---

## Seed data end-to-end

Run `npx prisma db seed`, then sign in as each seeded user:

| User role | Expected result |
|-----------|-----------------|
| staff     | Therapies list shows 3–5 sample therapies. Ailment detail shows assignment dropdown. |
| agent     | Ailment detail shows assigned therapy name (read-only). |
| admin     | Same access as staff for all therapy and ailment pages. |

- [ ] Seed script runs without error
- [ ] At least one seeded ailment shows an assigned therapy with status `IN_TREATMENT`

---

## Role access

| Action                          | agent | staff | admin |
|---------------------------------|-------|-------|-------|
| View therapy list               | ✗     | ✓     | ✓     |
| Create therapy                  | ✗     | ✓     | ✓     |
| Edit therapy                    | ✗     | ✓     | ✓     |
| Delete therapy (not in use)     | ✗     | ✓     | ✓     |
| Assign therapy to ailment       | ✗     | ✓     | ✓     |
| View assigned therapy on ailment| ✓     | ✓     | ✓     |

- [ ] Agent cannot access `/therapies` (redirected or 403)
- [ ] Staff can assign a therapy from the ailment detail page
- [ ] Deleting an in-use therapy shows a descriptive inline error, does not delete

---

## Manual browser smoke-test

Perform at **375 px**, **768 px**, and **1280 px** viewport widths:

- [ ] Therapy list — no horizontal scroll; name, duration, and description readable
- [ ] Create/edit therapy form — inputs are full-width on mobile; submit accessible
- [ ] Ailment detail (staff view) — assignment dropdown and Assign button visible; no overflow
- [ ] Ailment detail (agent view) — assigned therapy name shown; no assignment controls visible
- [ ] Navigation — "Therapies" link appears for staff/admin and is absent for agent

---

## Merge criteria

All checkboxes above must be ticked before the branch is merged to `main`.
