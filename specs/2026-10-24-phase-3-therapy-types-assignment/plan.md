# Phase 3 — Therapy Types & Assignment: Plan

## Task Groups

### 1. Data model & migrations
1.1 Add `Therapy` model to `schema.prisma` (`id`, `name`, `description`, `durationMinutes`, `createdAt`)  
1.2 Add nullable `therapyId` FK to the `Ailment` model  
1.3 Run `npx prisma migrate dev --name phase-3-therapies`  
1.4 Regenerate Prisma client (`npx prisma generate`)  

### 2. Seed data
2.1 Extend `prisma/seed.ts` to create 3–5 sample therapy types (e.g. "Prompt Detox", "Context Window Cleanse", "Hallucination CBT")  
2.2 Assign a therapy to at least one seeded ailment with status updated to `IN_TREATMENT`  
2.3 Verify `npx prisma db seed` runs without error  

### 3. Server-side data helpers
3.1 Add `src/lib/therapies.ts` — `getAllTherapies`, `getTherapyById`, `createTherapy`, `updateTherapy`, `deleteTherapy`  
3.2 `deleteTherapy` checks for referencing ailments; throws a descriptive error if any are found  
3.3 Add `assignTherapy(ailmentId, therapyId)` to `src/lib/ailments.ts`; sets `therapyId` and updates status to `IN_TREATMENT`  

### 4. Therapy management UI (staff & admin)
4.1 Add route `src/app/(protected)/therapies/page.tsx` — list all therapies with name, duration, description  
4.2 Add route `src/app/(protected)/therapies/new/page.tsx` — create form; server action in `src/app/(protected)/therapies/actions.ts`  
4.3 Add route `src/app/(protected)/therapies/[id]/edit/page.tsx` — edit form; server action updates record  
4.4 Delete action on list page; show inline error if therapy is in use  
4.5 Redirect on success; show `aria-invalid` inline errors on validation failure  

### 5. Ailment detail page
5.1 Add route `src/app/(protected)/ailments/[id]/page.tsx`  
5.2 Agents see: description, severity, status, assigned therapy name (or "None assigned")  
5.3 Staff/admin additionally see: therapy assignment dropdown + "Assign" button (server action); only shown when ailment is OPEN or IN_TREATMENT  
5.4 Link from ailment list rows to this detail page  

### 6. Navigation wiring
6.1 Add "Therapies" link to sidebar for `staff` and `admin` roles  

### 7. Responsive design
7.1 Therapy list renders correctly at 375 px, 768 px, 1280 px  
7.2 Create/edit therapy forms are full-width on mobile  
7.3 Ailment detail page renders correctly at all breakpoints  

### 8. Vitest tests
8.1 `src/tests/therapies.test.ts` — `createTherapy`, `updateTherapy`, `deleteTherapy` (in-use guard)  
8.2 `src/tests/ailments.test.ts` — `assignTherapy` sets therapyId and updates status to `IN_TREATMENT`  
8.3 All existing tests continue to pass  
