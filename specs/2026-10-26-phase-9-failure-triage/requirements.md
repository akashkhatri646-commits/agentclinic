# Phase 9 — Failure Triage & Prioritized Fixes: Requirements

## Scope

### In
- **R1 Themes on scenarios**: every golden scenario carries one authored `theme` naming the weakness it probes (for example negation, fabrication vocabulary, expectation gaps, sarcasm and idiom). Themes have a stable id, a label and a one-line description.
- **R2 Failure modes**: failing scenarios are grouped by theme into persisted failure modes. Each records how many of its scenarios fail in the specialist's current state (its frequency), which ones, and whether it is open or resolved. They are created and updated automatically after every eval run, fail-soft.
- **R3 Priority score and backlog**: each open failure mode gets a score of frequency × severity ÷ effort. Frequency is automatic; severity is suggested from the failing scenarios and staff can override it; effort is S, M or L set by staff. All three inputs and the formula are visible beside the score, and the open failure modes are shown ranked by score.
- **R4 Fixes and their lifecycle**: staff create fixes against a failure mode, pick an owner from staff and admin users, and move each fix through proposed, in progress, shipped (recording the version it shipped in) and verified. Every change is recorded with who made it and when.
- **R5 Automatic verification**: a shipped fix is verified, by the system and not by hand, when a run of the version it shipped in (or a later one) passes every scenario of its failure mode. The verifying run is recorded. A shipped fix whose scenarios still fail stays shipped and visibly says it is not yet verified.
- **R6 Regression flags**: (a) when a failure mode that had been resolved fails again in a later run, it reopens with a "reappeared" flag; (b) when a scenario that passed in the previous version fails in this one, the mode shows it as a regressed scenario.
- **R7 Notifications**: fix owners get an in-app notification when a fix is assigned to them, when it is verified, and when its failure mode reappears.
- **R8 Pages and access**: a ranked backlog page and a failure mode detail page, linked from the sidebar, for staff and admin only, with every action re-checking the session, the role and its inputs on the server.
- **R9 Seeded backlog**: a fresh install shows a backlog derived from the real seeded runs, plus a few illustrative fixes (flagged as sample) created and verified through the real logic.
- **R10 Quality, responsive, accessible**: Vitest coverage for grouping, scoring, state decisions, lifecycle transitions and verification; lint, type check and build clean; axe clean; no horizontal scroll or clipped header at 375 / 768 / 1280 px.

### Out
- Suggesting or generating fixes automatically (including with an LLM).
- Editing themes or scenarios in the UI, or merging and splitting failure modes (Phase 10 moves scenario sets into data).
- More than one specialist, due dates, SLAs, comments, attachments, bulk actions.
- A dashboard tile for the top-priority failure mode (the dashboard already carries the loop-time tile).
- Email or push delivery of notifications.

## Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Grouping | One authored theme per scenario; a failure mode is a theme | Makes each failure mode name a fixable weakness ("handle negation") instead of a symptom ("therapy mismatch"). It is how real error analysis is done; the cost is tagging 32 scenarios once |
| Storage | New `FailureMode`, `Fix` and `FixEvent` tables with clinic wording in the UI | The roadmap suggests reusing the ailment model. The Ailment table belongs to agents and is shown to them, and the Therapy table is the catalogue the eval itself checks against; mixing eval data into either would leak it to agents and let a fix edit the environment under test. The UI keeps the metaphor (a failure mode is the specialist's ailment, a fix its therapy) |
| Fix history | A `FixEvent` row for every create, status change, owner change and verification, with the actor | "Records who made it" needs more than a status column, and the timeline is part of staying with a fix until it ships |
| Score | `frequency × severity ÷ effort`; severity 1 to 3, effort 1 to 3 | The strategy doc said "× effort" by mistake; the roadmap and common sense say effort divides, since a bigger job lowers priority. The strategy doc is corrected in this phase |
| Frequency | Scenarios of the theme failing in the current state | Automatic, so it cannot drift from the results |
| Severity | Suggested as the highest expected severity among the failing scenarios (low 1, medium 2, high 3); staff may override with 1 to 3, or clear the override | A fix for something that breaks high-severity cases matters more; the override covers judgement the data cannot see |
| Effort | S, M or L (1, 2, 3), default M, set by staff | Only people know the cost of a fix |
| Ranking | Open modes by score, highest first; ties by severity, then frequency, then label | A stable, explainable order |
| Current state | A failure mode's state follows the latest-released version that has been evaluated. A run of an older version never changes it | Otherwise re-running `v1` after `v2` would reopen everything `v2` fixed. Runs of the same version or a newer one update the state |
| Sync timing | Automatically after each run, inside the runner, fail-soft | The backlog is never stale after a run, and a problem in this step is logged and never fails the run (the rule used for notifications and the judge). Because verification asks "a run of that version or later passes", a missed sync heals on the next run |
| Sync design | A pure function plans the changes from the current state and the run; a thin step applies them | The rules (reopen, resolve, verify, flag) are the risky part, so they are tested without a database |
| Resolve and reopen | A mode with no failing scenarios in the current state is resolved; a resolved mode that fails again reopens with `reappeared` set | This is the roadmap's "discharged failure mode reappears" |
| Verification | Staff record the version a fix shipped in; a run of that version or later that passes all the mode's scenarios verifies it. The verified time is the run's finish time, and the run is stored | Verification is evidence from a run, not a claim. Using the run's time keeps seeded history consistent |
| Verified is system-only | Staff cannot set a fix to verified | Otherwise a fix could be declared done while its scenarios still fail |
| Allowed transitions | proposed to in progress; in progress to proposed or shipped; shipped to in progress; verified to nothing | Forward by hand, with room to step back one stage when a mistake or a revert needs it |
| Owner | Chosen from staff and admin users | A real user can be notified and cannot dangle or be misspelled |
| Permissions | Any staff or admin may edit inputs and move fixes | Keeps the program unblocked when an owner is away; the history shows who did what |
| Notifications | Reuse the in-app notifications, fail-soft: assignment, verification, reappearance | The "stay with the fix until it ships" part of the role |
| Seed | Backlog derived from the real `v1` and `v2` runs; illustrative fixes flagged `isSample`, created between the two runs so the real verification logic verifies them | The scores and failure modes are real; only the invented fix titles, owners and dates are sample, and the UI says so |
| Navigation | Sidebar link "Triage" for staff and admin | Same pattern as Evals and Metrics |

## Themes

Each scenario gets one theme. The assignment is judgement and is reviewable in `src/lib/evals/scenarios/intake-triage.ts`.

| Theme id | Label | Scenarios |
|---|---|---|
| `token-anxiety` | Token and budget worries | d01, d08, d09, d18, h06 |
| `ambiguous-prompts` | Ambiguous or contradictory prompts | d02, d03, d14, d15, h03, h07 |
| `fabrication-vocabulary` | Fabrication vocabulary | d04, d05, d17, d21, h02 |
| `expectation-gap` | Human expectation gaps | d11, d12, d13, d22, h04 |
| `context-carryover` | Context carry-over | d10, d20, h05 |
| `persistent-wording` | Persistent or chronic wording | d07, d19, h01 |
| `negation` | Negated wording | d16 |
| `softening-words` | Softening words | d06 |
| `sarcasm-and-idiom` | Sarcasm and idiom | d23, d24 |
| `frequency-vs-intensity` | Frequency words read as intensity | h08 |

With the shipped specialists: `v1` fails 17 scenarios across 8 themes; `v2` fails 3 across 2 (`sarcasm-and-idiom` and `frequency-vs-intensity`).

## State rules (what the sync decides)

For a completed run of version V, for each theme:
1. If V is older than the version that last updated this mode, do nothing to the mode's state (fix verification can still apply).
2. If the theme has failing scenarios and no mode exists, create it as open, recording the run and its time.
3. If it has failing scenarios and the mode is open, update frequency, the failing scenario ids, the suggested severity, and the regressed scenarios (those that passed in the previous version's latest run).
4. If it has failing scenarios and the mode is resolved, reopen it, set `reappeared`, record when, and notify the owners of its verified fixes.
5. If it has no failing scenarios and the mode is open, resolve it, recording the run and its time.
6. For every shipped fix whose mode has no failing scenarios in this run and whose shipped version is at or before V, mark the fix verified by this run and notify its owner.

## Context

- **Users affected**: staff and admin. Agents never see any of it.
- **Dependencies**: the runner, results, scenarios, versions and `compareRuns` (Phases 7 and 8), the notification helpers (Phase 6), the guards, the sidebar, and the audit script. The seed already runs `v1` then `v2` through the real runner.
- **Constraints** (from `specs/tech-stack.md`): Prisma only, no raw SQL in app code; server components and server actions, no client data-fetching library; PicoCSS overrides in `globals.css`; strict TypeScript; `prisma/dev.db` not committed; responsive at 375 / 768 / 1280 px with no horizontal scroll and no clipped header. SQLite with this Prisma version has no JSON or list columns, so lists of scenario ids are stored as JSON text and read through one small helper.
- **Mission fit**: this is the "findings become fixes" step of the strategy, and the "Recovery" value (tracked from intake to discharge) applied to the specialist.
- **Risks**:
  - Theme tagging is subjective. Mitigated by a short description per theme, a test that every scenario has a known theme and every theme is used, and review in the diff.
  - State rules across versions are easy to get wrong. Mitigated by planning them in a pure function with a table of cases, including re-runs of older versions.
  - The reappearance flag cannot occur with the seeded data. Mitigated by unit tests and a documented manual trigger (delete an unused therapy, then re-run `v2`).
  - Two runs finishing at once could race on the same mode. Upserts on a unique key keep it consistent enough for a local app; logged as a follow-up.
  - User-typed fix text is shown on a page: it is rendered as text by React, and lengths are limited.
  - Server actions can be called directly: every one re-checks session and role and validates every input (effort and severity ranges, a real version, an owner who is staff or admin, an allowed transition).
- **Open questions for later phases**: moving scenarios and themes into data with an editor (Phase 10), and whether fix suggestions should be generated.
