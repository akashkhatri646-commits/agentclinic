# Follow-ups

Known issues and deferred work. Nothing here blocks the current build. Items come from the Phase 6 code review unless noted.

## Phase 6 review findings (not yet fixed)

| # | Area | Issue | Impact | Suggested fix |
|---|---|---|---|---|
| 1 | Discharge | Appointments cancelled by a discharge send no notification | The practitioner keeps expecting a session that was cancelled | Notify the staff member on each cancelled appointment; collapse to one notification per practitioner |
| 2 | `assignTherapyAction` | Does not verify the therapy exists; silently returns on missing fields | A forged `therapyId` causes a 500 instead of the friendly error path | Look up the therapy first and use `backWithError` |
| 3 | Ailment detail | The `?error=` query value is shown as-is | A crafted link can display misleading text inside the app's alert (not XSS; React escapes it) | Map a short error code to a fixed message, or drop the query-string pattern |
| 4 | Notifications | `markNotificationReadAction` ignores whether anything changed; `href` is not validated | No feedback on a stale id; a future external `href` would be a redirect risk | Return a result; restrict `href` to `/dashboard/...` in `createNotification` |
| 5 | Discharge | Two simultaneous discharges can both pass the status check | Duplicate "discharged" notifications; the second overwrites the note | Guard the update with `where: { status: { not: "RESOLVED" } }` |
| 6 | Appointments | `updateAppointmentStatus` allows any transition (e.g. CANCELLED to CONFIRMED) | Only the UI action guards it | Enforce allowed transitions in the library |
| 7 | Notifications | Message times are formatted in the server's locale and timezone | Wall-clock time can differ from what the UI shows | Store structured data and format at render time |
| 8 | Appointments | Booking and status-change notifications are written sequentially | Extra latency per request | Combine into one `Promise.all` |

## Inherited from Phase 4 (booking)

| Issue | Impact | Suggested fix |
|---|---|---|
| No atomicity between "is there an active appointment" and "create it" | A double click or two tabs can create two PENDING appointments for one ailment | Unique constraint or a transaction |
| `therapyId` is taken from the form and not checked against the ailment's therapy | A forged form can book a different therapy | Use `ailment.therapyId` server-side |


## Phase 7 (eval harness)

| Area | Issue | Impact | Suggested fix |
|---|---|---|---|
| LLM judge | Never run against the real API; only tested with a fake client | Request shape, structured-output parsing and model behaviour are unverified end to end | Run `npm run eval -- --judge` once with an `ANTHROPIC_API_KEY` and record the result |
| Hold-out set | The scenarios and the `v2` rules were written by the same author in one sitting | The hold-out is not statistically independent, so the `v2` PASS demonstrates the harness, not that `v2` generalises. Some `v2` vocabulary (for example "do not exist", "leak") overlaps hold-out wording | Have a second person write new hold-out scenarios; rotate real failures into the dev set (Phase 9) |
| Scenarios and specialists | Defined in code, not data | Adding a scenario or specialist means a code change | Move to the database with an editor (Phase 10) |
| Concurrency and cost | Two runs can be started at once, there is no throttle, and runs cannot be deleted. With the judge on, each run makes one small Haiku call per passing scenario (about 30) | Extra rows, and API spend that is unbounded in principle (cents per run in practice); staff-only | Optional: disable the button while a run is in flight, rate-limit the action, add run deletion |
| Unknown run id | Returns HTTP 200 with the not-found page | Same for every route with a loading skeleton; only matters to tools that read the status code | Accept, or drop the skeleton on that route |
| Demo data | `prisma/seed.ts` names a demo agent's model `claude-3-haiku-20240307`, a retired model id | Cosmetic; no API call uses it | Rename to a current model string |
| Header at 375 px | The header now wraps onto several lines | Works, but a proper mobile menu would be tidier | Collapse the nav behind a menu button on small screens |
| Process | Phase 6's "no horizontal overflow" check passed while the Sign out button was clipped off-screen at 375 px, because the layout hides overflow instead of scrolling | Fixed in Phase 7; `npm run audit` now checks the button is on screen | Keep that check; consider an explicit visual review at 375 px for any header change |

### Not verified in Phase 7

- The manual flows in `specs/2026-10-25-phase-7-eval-harness/validation.md` were checked over HTTP and in headless Chrome, not walked through by hand in a browser.
- The README run-locally steps have still not been tested on a clean clone.

## Phase 8 (loop-time metrics)

| Area | Issue | Impact | Suggested fix |
|---|---|---|---|
| Seeded timings | The `v1` (21 days) and `v2` (2 days) loop times are invented, by design and flagged as sample | The headline story is illustrative, not measured; a real loop time needs real use over days | Replace with real data as versions ship; keep the flag so it is never confused |
| Very little data | Only two versions exist, so the median, baseline and "trend" rest on two points | Statistics and the chart say little yet | Add versions and runs; show the sample size next to each number (already done) |
| Sample and real mixed | A database that already has real runs plus the seeded sample runs mixes both into the median, with only a notice to say so | The headline could blend invented and real timings | Offer a toggle to exclude sample runs from the headline once real data exists |
| Release dates | A version's release date is a constant in code, and `v1` and `v2` are both dated the day they were written | No "Change" record, so non-code changes (prompts, config) cannot be logged; real release times are approximate | Add a Change record and form (Phase 10) |
| Chart | No keyboard focus or custom tooltips: hover uses native tooltips and the table beneath is the accessible alternative. Loop time is not charted | Less interactive than it could be | A loop-time bar chart against the target; keyboard-focusable points |
| Time zone | Dates are shown in UTC | Unfamiliar for some readers, but identical everywhere | Add a viewer time-zone setting if needed |

### Not verified in Phase 8

- The manual flows in `specs/2026-10-25-phase-8-loop-time-metrics/validation.md` were checked over HTTP and in headless Chrome, not by hand in a browser.
- The chart was checked in headless Chrome screenshots and by the axe audit, not with a screen reader.

## Phase 9 (failure triage)

| Area | Issue | Impact | Suggested fix |
|---|---|---|---|
| Themes | Each scenario's theme is authored judgement, one theme per scenario, with no way to edit them in the app | A mis-tagged scenario puts a failure in the wrong failure mode, and adding a scenario or theme is a code change | Review the tagging in the diff; move scenarios and themes into data with an editor (Phase 10) |
| Seeded fixes | The seeded fix titles, owners and dates are invented (flagged sample) and send no notifications | A fresh install cannot show a notification arriving from the seed | Create a real fix to see notifications; real fixes notify as designed |
| Reappearance | Cannot happen from specialist changes alone with two versions; it needs an environment change (for example a missing therapy) or a third version | The flag is only visible after a deliberate trigger | Documented trigger in the README; add a third specialist version |
| Sync failure | If the sync fails after a run, the backlog is stale until the next run; there is no rebuild-from-runs tool | A transient error leaves the backlog behind | Add a "re-sync" action, or run the sync again from the CLI |
| Concurrency | Two runs finishing at once could race on the same failure mode | Possible lost update on a local app; the unique key keeps rows consistent | Serialise the sync, or make updates conditional |
| Score inputs | Changing severity or effort is not recorded in a history, only fix changes are | No audit trail for why a ranking changed | Add a small history for failure-mode input changes |
| Fixes | A fix belongs to one failure mode and cannot be edited, deleted or moved | A typo in a title stays; a fix that covers two modes needs two records | Add edit and delete, and let a fix cover several modes |
| Verification | A fix is verified only when every scenario of its failure mode passes, with no partial credit | A mode with one stubborn scenario holds back every fix to it | Show per-scenario progress, or allow splitting a mode |
| Single specialist | Triage is built for the intake-triage specialist only | Not yet usable for another specialist | Generalise with bring-your-own specialists (Phase 10) |
| Actions on the wrong page | Posting a triage action to a page that does not host it returns a 500 for any role | Harmless (nothing changes) and only reachable by hand-crafted requests | Accept, or handle the unknown-action case |

### Not verified in Phase 9

- The manual flows in `specs/2026-10-26-phase-9-failure-triage/validation.md` were exercised over HTTP and in headless Chrome, not by hand in a browser, and the pages were not tested with a screen reader.
- The reappearance flow was checked by deleting the therapy directly in the database, not through the Therapies page.

## Design notes

- Discharging an `OPEN` ailment with no therapy is allowed (the Phase 6 plan permits it). The agent's notification then points to a history that only shows intake and discharge.
- Notifications are read on page load, with no polling or push. Intentional for a local-first app.

## Not verified

- The manual flows in `specs/2026-10-24-phase-6-discharge-notifications-hardening/validation.md` have not been walked through by hand. They were checked over HTTP and in headless Chrome only.
- The README's run-locally steps have not been tested on a clean clone.

## Tooling

- `next start` needs `AUTH_TRUST_HOST=true` locally. `npm run dev` does not.
- `npm run audit` (`scripts/audit.js`) needs the app running on port 3100 with the seeded database, and Chrome. It signs in as each role, so it relies on the demo accounts from `prisma/seed.ts`.
