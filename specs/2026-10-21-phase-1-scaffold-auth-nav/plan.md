# Plan — Phase 1: Project Scaffold, Auth & Navigation

## Group 1 — Project Setup

1. Initialise Next.js 14 project with TypeScript and Tailwind CSS (`npx create-next-app@latest`)
2. Configure `tsconfig.json` with `"strict": true`
3. Add Prisma: `npm install prisma @prisma/client`, run `npx prisma init --datasource-provider sqlite`
4. Define initial `schema.prisma`: `User` model with `id`, `email`, `passwordHash`, `role`, `createdAt`
5. Run `npx prisma db push` to create `prisma/dev.db`
6. Add `prisma/dev.db` and `.env.local` to `.gitignore`
7. Create `.env.local.example` documenting required variables (`DATABASE_URL`, `AUTH_SECRET`)

## Group 2 — Authentication

1. Install Auth.js: `npm install next-auth@beta @auth/prisma-adapter`
2. Create `src/lib/auth.ts` — configure Auth.js with credentials provider and Prisma adapter
3. Add `src/app/api/auth/[...nextauth]/route.ts` — wire up the Auth.js handler
4. Create `src/lib/prisma.ts` — singleton Prisma client for server use
5. Add session middleware (`middleware.ts`) to protect all routes under `/dashboard`
6. Create `/login` page with email + password form and server action
7. Add role enum to Prisma schema: `enum Role { AGENT STAFF ADMIN }`; regenerate client

## Group 3 — Layout & Seed

1. Create `src/app/layout.tsx` — root layout with `<SessionProvider>`, font, and base Tailwind styles
2. Build `src/components/NavBar.tsx` — top navigation bar with sign-out button and role-aware links
3. Build `src/components/Sidebar.tsx` — placeholder sidebar (empty nav items, ready for Phase 2)
4. Create `src/app/dashboard/layout.tsx` — protected shell composing `NavBar` + `Sidebar`
5. Verify responsive layout at 375 px (mobile) and 1280 px (desktop)
6. Write `prisma/seed.ts` — seed one user per role (`agent@clinic.local`, `staff@clinic.local`, `admin@clinic.local`) with hashed passwords
7. Add `"prisma": { "seed": "ts-node prisma/seed.ts" }` to `package.json`; confirm `npx prisma db seed` runs cleanly

## Group 4 — Home Page

1. Create `src/app/page.tsx` — public landing page (no auth required); displays clinic name, tagline, and a "Sign In" CTA button linking to `/login`
2. If a session exists, replace the "Sign In" CTA with a "Go to Dashboard" link (server component session check)
3. Update `middleware.ts` to protect only `/dashboard/*`, leaving `/` and `/login` publicly accessible
4. Apply Tailwind for a clean centred layout that works at both 375 px and 1280 px

## Group 5 — Main Layout Component

1. Create `src/styles/layout.css` — layout-specific styles (structural rules that complement Tailwind)
2. Create `src/components/layout/Header.tsx` — `<header>` sub-component wrapping the site NavBar
3. Create `src/components/layout/Main.tsx` — `<main>` sub-component that wraps page content
4. Create `src/components/layout/Footer.tsx` — `<footer>` sub-component with clinic name and copyright
5. Create `src/components/layout/MainLayout.tsx` — composes `Header`, `Main`, and `Footer`; imports `layout.css`
6. Update `src/app/dashboard/layout.tsx` to use `MainLayout` in place of the inline `NavBar` + flex shell
