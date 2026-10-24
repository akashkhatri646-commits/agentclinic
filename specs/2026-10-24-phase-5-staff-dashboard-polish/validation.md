# Phase 5 — Staff Dashboard & UI Polish: Validation

## Automated

### Vitest suite (`npm test`)
- [ ] `dashboard.test.ts` — `getDashboardStats` returns correct `activeCaseload` count from seeded data
- [ ] `dashboard.test.ts` — `getDashboardStats` returns the next 5 upcoming appointments sorted by `scheduledAt`
- [ ] `dashboard.test.ts` — `getDashboardStats` returns correct LOW / MEDIUM / HIGH counts for open ailments
- [ ] All existing Phase 1–4 tests continue to pass (no regressions)
- [ ] `npm test` exits 0 with no skipped tests

---

## Seed data end-to-end

Run `npx prisma db seed`, then sign in as each seeded user:

| User role | Expected result |
|-----------|-----------------|
| staff     | Dashboard shows correct active caseload count, upcoming appointments, and severity breakdown. |
| admin     | Dashboard visible; admin panel shows user list with role assignment controls. |
| agent     | Redirected away from `/dashboard` (agents land on `/ailments`). |

- [ ] Seed script runs without error
- [ ] Dashboard severity bar chart proportions reflect actual seed data counts

---

## Role access

| Action                        | agent | staff | admin |
|-------------------------------|-------|-------|-------|
| View dashboard                | ✗     | ✓     | ✓     |
| View admin user list          | ✗     | ✗     | ✓     |
| Change a user's role          | ✗     | ✗     | ✓     |

- [ ] Agent is redirected away from `/dashboard`
- [ ] Staff cannot access `/admin/users` (redirected or 403)
- [ ] Admin cannot change their own role (guard active)

---

## Accessibility

- [ ] `npx axe-cli` reports zero WCAG 2.1 AA violations on: `/dashboard`, `/ailments`, `/ailments/new`, `/therapies`, `/appointments`
- [ ] All icon-only buttons have an accessible `aria-label`
- [ ] Booking flow (Phase 4) is fully keyboard-navigable in correct tab order

---

## Performance

- [ ] `npm run build` completes without errors
- [ ] No route exceeds **250 kB** first-load JS as reported in build output

---

## Manual browser smoke-test

Perform at **375 px**, **768 px**, and **1280 px** viewport widths:

- [ ] Dashboard panels stack vertically on mobile; no horizontal scroll
- [ ] Empty states shown correctly on pages with no data (fresh database)
- [ ] Loading skeletons appear before content on list and detail pages
- [ ] Consistent typography and heading hierarchy on every page (one `<h1>` per page)
- [ ] Severity badge colours consistent across ailment list, detail, and dashboard

---

## Merge criteria

All checkboxes above must be ticked before the branch is merged to `main`. This phase represents the completed MVP.
