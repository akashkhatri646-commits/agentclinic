# Phase 5 — Staff Dashboard & UI Polish: Plan

## Task Groups

### 1. Staff dashboard page
1.1 Add route `src/app/(protected)/dashboard/page.tsx` for `staff` and `admin` roles  
1.2 Add `getDashboardStats()` to `src/lib/dashboard.ts` — returns active caseload count, next 5 appointments, severity breakdown  
1.3 Render "Active Caseload" stat tile (OPEN + IN_TREATMENT count)  
1.4 Render "Upcoming Appointments" table (next 5, sorted by scheduledAt, linked to ailment detail)  
1.5 Render "Severity Breakdown" CSS-only bar chart using PicoCSS `<progress>` elements for LOW / MEDIUM / HIGH counts  
1.6 Redirect `/` to `/dashboard` for authenticated staff/admin; agents remain on `/ailments`  

### 2. Admin panel
2.1 Add route `src/app/(protected)/admin/users/page.tsx` — list all users with name, email, role  
2.2 Add server action `updateUserRole` in `src/app/(protected)/admin/actions.ts`; staff role cannot be assigned to the currently signed-in admin (guard)  
2.3 Link therapy management (`/therapies`) from admin sidebar (no duplication of CRUD pages)  

### 3. UI polish — empty states & loading skeletons
3.1 Add `<EmptyState>` component to `src/components/EmptyState.tsx`; accept `message` and optional `actionHref` + `actionLabel` props  
3.2 Replace plain "no items" text on all list pages (ailments, therapies, appointments) with `<EmptyState>`  
3.3 Add CSS skeleton shimmer class to `src/app/globals.css`; apply to list and detail pages during server component loading  

### 4. UI polish — typography, colour & animations
4.1 Audit and consolidate colour tokens in `src/app/globals.css`; ensure severity badge colours use `--pico-color-*` variables consistently  
4.2 Add CSS transition on navigation hover states and button focus rings  
4.3 Ensure consistent heading hierarchy across all pages (one `<h1>` per page)  

### 5. Accessibility audit
5.1 Add `aria-label` or visible label to every icon-only button  
5.2 Verify keyboard tab order on booking flow (step 1 → 2 → 3 → confirm)  
5.3 Run axe-core (via `npx axe-cli`) against dev server on at least 5 key pages; resolve any WCAG 2.1 AA violations  
5.4 Confirm colour contrast ≥ 4.5:1 on all text/background combinations (use browser DevTools Accessibility panel)  

### 6. Performance review
6.1 Run `npm run build` and inspect route sizes in build output; flag any route exceeding 250 kB first-load JS  
6.2 Optimise any flagged route (lazy imports, move heavy components to client boundary)  

### 7. Full test suite
7.1 Ensure `npm test` passes across all phases with no skipped tests  
7.2 Add `src/tests/dashboard.test.ts` — `getDashboardStats` returns correct counts from seeded data  

### 8. Responsive final pass
8.1 Smoke-test every page at 375 px, 768 px, 1280 px; resolve any horizontal scroll or overflow  
8.2 Confirm dashboard panels stack vertically on mobile using PicoCSS grid  
