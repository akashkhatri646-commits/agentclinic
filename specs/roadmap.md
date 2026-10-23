# Roadmap

Delivery is split into small, shippable phases. Each phase produces working, deployable software. Later phases build on earlier ones without breaking them.

---

## Phase 1 — Project Scaffold, Auth & Navigation ✓ Complete

Goal: a deployable skeleton that any team member can run locally and that handles sign-in/sign-out.

- Initialise Next.js 14 project with TypeScript and Tailwind CSS
- Add Prisma with SQLite adapter; commit `schema.prisma`, add `prisma/dev.db` to `.gitignore`
- Implement Auth.js (NextAuth) with credentials provider; add `AUTH_SECRET` to `.env.local`
- Basic layout: top navigation bar, sidebar placeholder, responsive shell
- Role seed: `agent`, `staff`, `admin` (seeded via `prisma/seed.ts`)
- Deploy to Vercel with preview environments
- Vitest setup; unit tests for role utilities

---

## Phase 2 — Agent Profiles & Ailments

Goal: agents can exist in the system and log what is troubling them.

- `agents` table: id, name, model, created_at, owner notes
- `ailments` table: id, agent_id, description, severity, status, created_at
- Agent profile page: view and edit own profile
- Ailment intake form: agents submit a new ailment
- Ailment list: agents see their own ailments with status badges
- Vitest tests for agent and ailment data logic

---

## Phase 3 — Therapy Types & Assignment

Goal: staff can define available therapies and assign them to ailments.

- `therapies` table: id, name, description, duration_minutes, created_at
- Staff UI: create and manage therapy types
- Ailment detail page: staff assign a therapy to an ailment
- Agent view: see assigned therapy on their ailment detail
- Vitest tests for therapy assignment logic

---

## Phase 4 — Appointment Booking Flow

Goal: agents can book an appointment for a therapy session.

- `appointments` table: id, agent_id, staff_id, ailment_id, therapy_id, scheduled_at, status
- Staff availability model (simple time-slot approach for now)
- Agent booking UI: pick a therapy, choose an available slot, confirm
- Staff calendar view: see upcoming appointments
- Email confirmation via a transactional email provider such as Resend (optional for this phase)
- Vitest tests for booking and availability logic

---

## Phase 5 — Staff Dashboard & UI Polish

Goal: staff and admins have a clear operational overview; the UI is attractive enough for marketing.

- Dashboard: active caseload, upcoming appointments, ailment severity distribution
- Admin panel: manage users, roles, and therapy catalogue
- UI polish: consistent typography, colour palette, animations, empty states, loading skeletons
- Accessibility audit (keyboard nav, ARIA labels, colour contrast)
- Performance review: image optimisation, bundle analysis
- Full `npm test` suite passing across all phases
