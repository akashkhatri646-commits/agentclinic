# Phase 4 — Appointment Booking: Validation

## Automated

### Vitest suite (`npm test`)
- [ ] `appointments.test.ts` — `getAvailableSlots` returns 8 slots for a day with no existing appointments
- [ ] `appointments.test.ts` — `getAvailableSlots` excludes slots already taken by PENDING or CONFIRMED appointments
- [ ] `appointments.test.ts` — `createAppointment` throws when the ailment has no assigned therapy
- [ ] `appointments.test.ts` — `createAppointment` throws when the ailment already has a non-cancelled appointment
- [ ] `appointments.test.ts` — `cancelAppointment` sets appointment status to CANCELLED
- [ ] All existing Phase 1, 2, and 3 tests continue to pass (no regressions)

---

## Seed data end-to-end

Run `npx prisma db seed`, then sign in as each seeded user:

| User role | Expected result |
|-----------|-----------------|
| agent     | Ailment detail shows active appointment (scheduled time + status badge) OR a "Book Appointment" CTA if none exists. |
| staff     | Calendar view shows 2–3 seeded appointments in the correct week slots. |
| admin     | Appointment list shows all seeded appointments across all staff. |

- [ ] Seed script runs without error
- [ ] At least two seeded appointments appear in the staff calendar view

---

## Role access

| Action                              | agent | staff | admin |
|-------------------------------------|-------|-------|-------|
| Book an appointment (own ailment)   | ✓     | ✗     | ✗     |
| Cancel own appointment              | ✓     | ✓     | ✓     |
| View staff calendar                 | ✗     | ✓     | ✓     |
| Confirm an appointment              | ✗     | ✓     | ✓     |
| Cancel any appointment              | ✗     | ✓     | ✓     |

- [ ] Agent cannot access `/appointments` calendar (redirected or 403)
- [ ] Agent can book only for their own ailments
- [ ] Staff can confirm and cancel appointments from the calendar view

---

## Manual browser smoke-test

Perform at **375 px**, **768 px**, and **1280 px** viewport widths:

- [ ] Booking flow step 1 — staff list renders cleanly; no overflow
- [ ] Booking flow step 2 — slot picker readable; radio buttons accessible on mobile
- [ ] Booking flow step 3 — confirm summary shows therapy name, staff, date, and time
- [ ] Ailment detail — active appointment panel shows status badge and cancel button
- [ ] Staff calendar — collapses to vertical list on mobile; no horizontal scroll
- [ ] Navigation — "My Appointments" link appears for agent; "Appointments" for staff/admin

---

## Merge criteria

All checkboxes above must be ticked before the branch is merged to `main`.
