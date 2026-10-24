# Phase 5 — Staff Dashboard & UI Polish: Requirements

## Scope

Staff and admins get an operational overview dashboard. Admins can manage users, roles, and the therapy catalogue. The entire UI is polished to conference-demo and marketing-ready quality.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Dashboard data is **server-rendered** (no client polling) | Consistent with the tech-stack constraint: no client-side data fetching libraries until justified. A manual refresh is sufficient for a demo context. |
| 2 | Admin user management is **role reassignment only** — no user creation or deletion | User creation is handled by the Auth.js sign-up flow; deletion is out of scope to keep admin UI minimal. |
| 3 | Admin therapy catalogue management **reuses the Phase 3 CRUD UI** | No duplication; admin accesses the same therapy management pages as staff. |
| 4 | Ailment severity distribution uses a **CSS-only bar chart** (no chart library) | Avoids a new dependency; PicoCSS progress bars can represent proportions cleanly. |
| 5 | Accessibility audit targets **WCAG 2.1 AA** | Keyboard nav, ARIA labels, and minimum 4.5:1 colour contrast on text. |
| 6 | Empty states and loading skeletons added to **all list and detail pages** | Consistent UX; especially important for demo environments starting with a fresh database. |
| 7 | Bundle analysis via `next build --profile` output | No additional tooling required; flag if any route exceeds 250 kB first-load JS. |

---

## Dashboard Panels (Staff & Admin)

| Panel                       | Data shown                                                          |
|-----------------------------|---------------------------------------------------------------------|
| Active caseload             | Count of OPEN + IN_TREATMENT ailments                               |
| Upcoming appointments       | Next 5 appointments, sorted by scheduledAt                          |
| Ailment severity breakdown  | Count of LOW / MEDIUM / HIGH among open ailments (CSS bar chart)    |

---

## Admin Panel Pages

| Page                  | Capability                                                          |
|-----------------------|---------------------------------------------------------------------|
| Users                 | List all users; change role (agent / staff / admin)                 |
| Therapy catalogue     | Linked to Phase 3 therapy management; no duplication                |

---

## Out of Scope (Phase 5)

- Email or push notifications
- Audit logging / activity feed
- Multi-clinic / multi-tenant support
- Custom report exports
