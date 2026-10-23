# Phase 2 — Agent Profiles & Ailments: Plan

## Task Groups

### 1. Styling setup — swap Tailwind for PicoCSS
1.1 Uninstall `tailwindcss`, `postcss`, `autoprefixer`; remove `tailwind.config.ts` and `postcss.config.js`  
1.2 Install `@picocss/pico`  
1.3 Replace Tailwind directives in `src/app/globals.css` with `@import "@picocss/pico"` and clinic-theme custom property overrides  
1.4 Verify `npx next build` passes with no Tailwind references remaining  

### 2. Data model & migrations
2.1 Add `AilmentSeverity` and `AilmentStatus` enums to `schema.prisma`  
2.2 Add `Agent` model with `userId` FK to `User`  
2.3 Add `Ailment` model with `agentId` FK to `Agent`  
2.4 Run `npx prisma migrate dev --name phase-2-agent-ailments`  
2.5 Regenerate Prisma client (`npx prisma generate`)  

### 3. Seed data
3.1 Extend `prisma/seed.ts` to create 2–3 sample agents (one per seeded user role)  
3.2 Add 3–5 ailments per agent with varied severity and status values  
3.3 Verify `npx prisma db seed` runs without error  

### 4. Server-side data helpers
4.1 Add `src/lib/agents.ts` — `getAgentByUserId`, `getAgentById`, `getAllAgents`  
4.2 Add `src/lib/ailments.ts` — `getAilmentsByAgentId`, `getAllAilments`, `createAilment`  
4.3 Enforce ownership: `getAilmentsByAgentId` validates caller is the owner or staff/admin  

### 5. Agent profile page
5.1 Add route `src/app/(protected)/profile/page.tsx`  
5.2 Fetch and display agent name, model, createdAt, ownerNotes using PicoCSS `<article>` / `<dl>` semantics  
5.3 Show a "No profile yet" empty state for users without an agent record  
5.4 Read-only — no edit form  

### 6. Ailment intake form
6.1 Add route `src/app/(protected)/ailments/new/page.tsx`  
6.2 Server action `createAilment` in `src/app/(protected)/ailments/actions.ts`  
6.3 Form fields: description (textarea), severity (select: Low / Medium / High); use PicoCSS native form styles — no extra classes needed  
6.4 On success, redirect to ailment list; on error, show inline validation message via `aria-invalid`  

### 7. Ailment list page
7.1 Add route `src/app/(protected)/ailments/page.tsx`  
7.2 Agents see only their own ailments; staff/admin see all  
7.3 Each row: description (truncated), severity badge, status badge, createdAt  
7.4 Empty state message if no ailments  
7.5 "Log a new ailment" CTA link to `/ailments/new`  

### 8. Navigation wiring
8.1 Add "My Profile" and "My Ailments" links to the sidebar for the `agent` role  
8.2 Add "All Ailments" link for `staff` and `admin` roles  

### 9. Responsive design
9.1 Use PicoCSS's responsive grid (`<div class="grid">`) for multi-column layouts; no custom breakpoint CSS unless needed  
9.2 Confirm profile page renders correctly at 375 px, 768 px, 1280 px  
9.3 Confirm ailment list renders correctly (PicoCSS `<table>` wraps in `<figure>` for horizontal scroll on mobile) at all breakpoints  
9.4 Confirm intake form renders correctly at all breakpoints (PicoCSS inputs are 100% width by default)  

### 10. Vitest tests
10.1 `src/tests/agents.test.ts` — unit tests for `getAgentByUserId`, `getAgentById`  
10.2 `src/tests/ailments.test.ts` — unit tests for `createAilment`, `getAilmentsByAgentId` (ownership check)  
10.3 All tests pass with `npm test`  
