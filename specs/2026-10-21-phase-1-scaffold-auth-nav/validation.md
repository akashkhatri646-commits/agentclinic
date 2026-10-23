# Validation — Phase 1: Project Scaffold, Auth & Navigation

The branch is ready to merge when every item below is checked off. Each check can be performed manually by a developer or an AI coding agent following the steps from a clean clone.

## Setup

- [ ] `npm install` completes with no errors
- [ ] `cp .env.local.example .env.local` (fill in `AUTH_SECRET`) — app starts without crashing
- [ ] `npx prisma db push` runs cleanly and creates `prisma/dev.db`
- [ ] `npx prisma db seed` completes without error and prints confirmation for all 3 seed users
- [ ] `npm run dev` starts with no TypeScript or runtime errors in the terminal

## Home page

- [ ] Navigating to `/` while unauthenticated shows the home page with the clinic name, tagline, and a "Sign In" CTA button
- [ ] Navigating to `/` while signed in shows a "Go to Dashboard" link in place of the "Sign In" button
- [ ] Home page renders correctly at 375 px with no horizontal scroll

## Authentication

- [ ] Navigating to `/dashboard` while unauthenticated redirects to `/login`
- [ ] Submitting the login form with valid seed credentials (`agent@clinic.local` / correct password) sets a session cookie and lands on `/dashboard`
- [ ] Submitting the login form with an incorrect password shows an error message and does not set a session
- [ ] Clicking sign-out clears the session and redirects to `/login`

## Role-based access

- [ ] Signed in as `admin@clinic.local` — the Admin nav item (or indicator) is visible
- [ ] Signed in as `agent@clinic.local` — the Admin nav item is not visible
- [ ] Signed in as `staff@clinic.local` — the Admin nav item is not visible

## Layout & responsiveness

- [ ] Nav bar renders at full desktop width (1280 px) with no overflow or broken layout
- [ ] Nav bar and layout render correctly at 375 px mobile width with no horizontal scroll
- [ ] Sidebar placeholder is present and does not throw errors (can be empty)

## Code quality

- [ ] `npx tsc --noEmit` exits with no errors
- [ ] `npm test` runs and all tests pass with no failures
- [ ] No `.env.local` or `prisma/dev.db` files appear in `git status`
