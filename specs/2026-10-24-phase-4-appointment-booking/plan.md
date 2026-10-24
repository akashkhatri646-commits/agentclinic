# Phase 4 — Appointment Booking: Plan

## Task Groups

### 1. Data model & migrations
1.1 Add `AppointmentStatus` enum to `schema.prisma` (`PENDING`, `CONFIRMED`, `CANCELLED`)  
1.2 Add `Appointment` model with FKs to `Agent`, `User` (staff), `Ailment`, `Therapy`; plus `scheduledAt` and `status`  
1.3 Run `npx prisma migrate dev --name phase-4-appointments`  
1.4 Regenerate Prisma client (`npx prisma generate`)  

### 2. Seed data
2.1 Extend `prisma/seed.ts` to create 2–3 sample appointments (mix of PENDING and CONFIRMED)  
2.2 Verify `npx prisma db seed` runs without error  

### 3. Server-side data helpers
3.1 Add `src/lib/appointments.ts` — `getAppointmentsByAgentId`, `getAppointmentsByStaffId`, `getAllAppointments`, `createAppointment`, `cancelAppointment`  
3.2 Add `getAvailableSlots(staffId, date)` in `src/lib/appointments.ts` — returns 1-hour blocks Mon–Fri 09:00–17:00 not already taken by a PENDING or CONFIRMED appointment for that staff member  
3.3 `createAppointment` enforces: ailment must have a therapy assigned; no existing non-cancelled appointment for that ailment  

### 4. Booking UI (agent)
4.1 Add "Book Appointment" section to the ailment detail page (`src/app/(protected)/ailments/[id]/page.tsx`); shown only when a therapy is assigned and no active appointment exists  
4.2 Add route `src/app/(protected)/ailments/[id]/book/page.tsx` — step 1: pick a staff member from the staff list; step 2: pick an available date (date input) and slot (radio list); step 3: confirm summary  
4.3 Server action `bookAppointment` in `src/app/(protected)/ailments/actions.ts`; on success redirect to ailment detail; on error show inline message  
4.4 Show existing appointment (status badge, scheduled time, cancel button) on ailment detail when one exists  

### 5. Staff calendar view
5.1 Add route `src/app/(protected)/appointments/page.tsx` — weekly calendar for the signed-in staff member; prev/next week navigation  
5.2 Each slot cell shows: agent name and therapy name; clicking opens the ailment detail  
5.3 Staff can confirm or cancel an appointment from a slot detail or inline action  
5.4 Admin sees all staff appointments in a list view with the same confirm/cancel actions  

### 6. Navigation wiring
6.1 Add "My Appointments" link to sidebar for `agent` role  
6.2 Add "Appointments" link to sidebar for `staff` and `admin` roles  

### 7. Responsive design
7.1 Booking flow pages render correctly at 375 px, 768 px, 1280 px  
7.2 Weekly calendar collapses to a vertical list on mobile (no horizontal overflow)  
7.3 Ailment detail "Book Appointment" section renders correctly at all breakpoints  

### 8. Vitest tests
8.1 `src/tests/appointments.test.ts` — `getAvailableSlots` excludes already-booked times  
8.2 `src/tests/appointments.test.ts` — `createAppointment` throws when ailment has no therapy  
8.3 `src/tests/appointments.test.ts` — `createAppointment` throws when a non-cancelled appointment already exists for the ailment  
8.4 `src/tests/appointments.test.ts` — `cancelAppointment` sets status to CANCELLED  
8.5 All existing tests continue to pass  
