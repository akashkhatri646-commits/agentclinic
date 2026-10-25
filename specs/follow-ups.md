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

## Design notes

- Discharging an `OPEN` ailment with no therapy is allowed (the Phase 6 plan permits it). The agent's notification then points to a history that only shows intake and discharge.
- Notifications are read on page load, with no polling or push. Intentional for a local-first app.

## Not verified

- The manual flows in `specs/2026-10-24-phase-6-discharge-notifications-hardening/validation.md` have not been walked through by hand. They were checked over HTTP and in headless Chrome only.
- The README's run-locally steps have not been tested on a clean clone.

## Tooling

- `next start` needs `AUTH_TRUST_HOST=true` locally. `npm run dev` does not.
- The audit script used for axe and responsive checks lived in a scratch directory. Consider committing it under `scripts/` for Phase 7 onward.
