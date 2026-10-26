# Phase 10 — Self-Serve Onboarding & Customer Instances: Requirements

## Scope

### In
- **R1 A domain-neutral specialist format.** A team describes its specialist in one JSON document: its name, the fields its specialist outputs, how each field is checked, its themes, and its golden scenarios (each with a split, a theme, an impact weight, an input, and the expected values). The format is validated in full before anything is saved, with errors that name the exact place.
- **R2 A generic grading engine.** Checks work on named fields, not on severity and therapy: a field must equal the expected value, must be one of a set, must be in a reference list that belongs to the environment, or must be non-empty; an optional LLM judge can grade one text field. The verdict, metrics and triage reuse it unchanged. The built-in intake-triage specialist is re-expressed in this format, and its seeded `v1` and `v2` results stay exactly as they are.
- **R3 Persistence in the database.** Specialists, scenarios, versions, customer instances and a specialist activity log become tables. Existing runs and results are migrated, not lost.
- **R4 Create and update by pasting or uploading JSON**, starting from one of three templates (the intake-triage worked example, a generic classification starter, a blank starter). Staff and admin can create; the owner or an admin can change; any staff or admin can view. After a specialist has runs, its definition can only grow, not break what the runs depend on.
- **R5 Import outputs to get a verdict.** A team imports what its specialist returned for every scenario, for a version and an environment, and the harness grades it into a run. The first time a version is imported it carries the time it shipped. The built-in specialist still runs from code, on one instance or on all of them.
- **R6 Customer instances.** Several named environments, each with its own reference data, are selectable when a run is made. Runs record their instance. Triage, metrics and fix verification take the **worst case across instances**: a scenario counts as failing if it fails on any instance whose latest run of the current version is on record.
- **R7 A specialist picker and the pages to manage specialists.** Specialists list, new, detail, edit and import pages, and a picker on the Evals, Metrics and Triage pages so each works for any specialist.
- **R8 An onboarding checklist page** that ticks each step from real data: create the specialist, add enough scenarios, import a first version's outputs, get a first verdict, create a first fix, verify a first fix.
- **R9 An adoption metric.** Across all specialists: how many reached a verdict, how many are fully onboarded (a verdict and a verified fix), what share of those were unassisted, and the median time from creation to first verdict.
- **R10 A playbook** in the repository, covering how to run the loop, read a verdict and triage failures, linked from the app and the README.
- **R11 Seeded content.** Three instances, the intake-triage example, and three illustrative sample specialists created through the real import pipeline, flagged as sample.
- **R12 Access control and input safety**, enforced on the server for every page and action.
- **R13 Quality, responsive, accessible**, with the audit script covering every new page.
- **R14 Behaviour preserved.** On the standard instance, every number validated in Phases 7 to 9 is unchanged: `v1` fails 17 scenarios and `v2` fails `d23`, `d24` and `h08`; 8 failure modes with 2 open; median loop time 11.5 days; 4 fixes verified by the `v2` run.

### Out
- Executing a team's specialist: no outbound HTTP calls, no code execution, no prompt running (teams import outputs).
- A form builder, editing scenarios one by one in the browser, or creating and editing instances in the UI (instances are seeded; an instance editor is a follow-up).
- A Team entity or membership management (a team is a specialist's owner).
- Deleting or renaming specialists, versions, scenarios or runs.
- Output values other than text, number and boolean; fuzzy or semantic matching of text.
- Per-instance triage views (instances are combined as worst case; the verdict page still shows each run on its own).
- Notifications for onboarding events.

## Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Generality | Domain-neutral fields and checks | It is what makes the method usable by a team with a different specialist. The cost is a refactor of the engine from Phases 7 to 9, made safe by a characterisation test and the pinned results |
| Execution | Teams import their specialist's outputs; the harness grades them | Real specialists run elsewhere. No code execution, no outbound calls (no server-side request forgery risk), no API key, fully local, works for any specialist |
| Definitions | In the database, added by importing JSON; intake-triage seeded as a worked example | Adding a specialist needs no code change or deploy. Built-in versions still produce outputs from code, then go through the same grading |
| Config input | Paste or upload JSON, validated with clear errors | Quick to build and reviewable; form building is out of scope. Errors are returned by the action and shown on the page, never carried in the URL |
| Format versioning | A `format` field (`agentclinic.specialist/1`) is required | Lets the format evolve without silently misreading old files |
| Check vocabulary | `equals`, `oneOf`, `inReference`, `nonEmpty`, plus an optional judge on one field | Enough to express the intake-triage specialist and a classifier; fuzzy matching would need new machinery and is out of scope |
| Value comparison | Values are compared as text after trimming (case-sensitive) | Predictable, and the same rule for every specialist. Numbers and booleans are converted to text |
| Scenario impact | An integer weight 1 to 3 per scenario, replacing the severity-specific field | Triage suggests a severity from the highest weight among failing scenarios. The intake-triage config maps low, medium and high to 1, 2 and 3, so its scores do not change |
| Failure categories | A category is the sorted list of failing checks as `TYPE:field`, joined by `+` (for example `MISMATCH:severity+MISMATCH:therapy`) | Generic and still informative. Existing stored categories are mapped by the migration. Reason text is generic too; only the pass or fail of each scenario is pinned |
| Version order | Versions are ordered by release time. A new version must be released after the latest one, and not in the future | The state rules (older runs never change state) rely on a total order |
| Release time | Required the first time a version is imported | "Change shipped" is the start of loop time. Defaulting it to the import time would make every loop look instant |
| Completeness | An outputs file is rejected unless it has an entry for every scenario and no entry for an unknown scenario | A partial file would silently fail scenarios and distort the rates; precise errors name the missing and unknown ids |
| Definition changes | The owner or an admin may replace the definition. Once a specialist has runs, scenarios, fields, themes and checks may be added or reworded but not removed or have their ids changed | Prevents breaking stored results and failure modes. Larger rewrites are a follow-up |
| Instances | A named environment with reference lists. The standard clinic reads the live therapy catalogue; the others are fixed snapshots | Keeps the Phase 7 behaviour (delete a therapy and re-run) on the standard instance, and gives fixed environments for the spread |
| Instances in aggregates | Worst case across the latest run of each instance for the current version | The strategy asks for a spread of environments, not one favourite. A fix is verified only if it works across them |
| Same-instance comparison | A run is compared with the previous version's latest run on the same instance | Apples to apples |
| Instance-driven reopening | A failure that appears because a run on a new instance fails reopens a failure mode like any other, and the page says which instance's run did it | Simple and consistent; the extra line stops it being mistaken for a regression of the specialist itself |
| Team and "unassisted" | A team is a specialist's owner. A specialist is unassisted when no admin other than its owner acted on it before it reached its first verified fix | No Team model. "Acted" covers creating or changing it, importing or running outputs, and moving its fixes |
| Fully onboarded | A first verdict and at least one verified fix | Matches the roadmap's "run the loop", not just "get a number" |
| Permissions | Staff and admin create; owner or admin change; staff and admin view | Ownership is what makes "unassisted" definable and stops teams editing each other's work |
| Templates | Three: intake-triage example, a generic classification starter, a blank starter | A worked example shows every feature, the classifier is the likely first use, the blank one is the minimum valid config |
| Starter delivery | The new-specialist page pre-fills the JSON box from a template; the outputs page can pre-fill a skeleton listing every scenario id | No download routes or extra endpoints to secure |
| Guided first run | A checklist page driven by real data, not a wizard | Resumable, honest, and the same data feeds the adoption metric |
| Playbook | A markdown file in `docs/`, readable on GitHub, linked from the checklist page and the README | One source of truth; no markdown renderer needed in the app |
| Seed | Three instances; the intake-triage example with its existing sample history; three sample specialists created through the real import path with invented timings and activity, flagged sample | The format and engine are exercised for real; only the invented timings and actors are sample |
| Seeded history unchanged | The seeded runs stay on the standard instance only | Keeps the validated Phase 7 to 9 numbers exact. The other instances start with no runs and are tried by hand |
| Picker | A `?specialist=<slug>` choice at the top of Evals, Metrics and Triage, defaulting to the first specialist created | Minimal change to existing routes; the slug is validated against the database |
| Dashboard tile | Stays on the default specialist | Aggregating across specialists would blend invented and real timings; noted as a follow-up |

## The specialist format (version 1)

```json
{
  "format": "agentclinic.specialist/1",
  "slug": "ticket-router",
  "name": "Support ticket router",
  "description": "Routes a support ticket to the right queue.",
  "outputFields": [
    { "name": "queue", "description": "The queue the ticket belongs in." }
  ],
  "checks": [
    { "field": "queue", "type": "equals" }
  ],
  "themes": [
    { "id": "billing", "label": "Billing questions", "description": "Charges, invoices, refunds." }
  ],
  "judge": { "field": "rationale" },
  "scenarios": [
    {
      "id": "s01",
      "split": "DEV",
      "theme": "billing",
      "weight": 2,
      "input": "I was charged twice this month.",
      "expected": { "queue": "billing" },
      "why": "A duplicate charge is a billing issue."
    }
  ]
}
```

Check types: `equals` (the output must equal the scenario's expected value for that field), `oneOf` (with `values`), `inReference` (with `list`, the name of a reference list the instance provides), `nonEmpty`. `judge` is optional.

Limits: at most 10 output fields, 40 checks, 20 themes, 200 scenarios; a scenario input up to 2,000 characters; a document up to 200 KB. Field names and theme ids match `^[A-Za-z][A-Za-z0-9_-]{0,39}$`; a slug matches `^[a-z0-9]+(-[a-z0-9]+)*$` and is at most 40 characters. Every scenario must have a DEV or HOLDOUT split, a known theme, and an `expected` value for each `equals` field; there must be at least one DEV scenario.

## The outputs file (version 1)

```json
{
  "format": "agentclinic.outputs/1",
  "version": "v2",
  "releasedAt": "2026-10-20T09:00:00Z",
  "summary": "Handles refund wording.",
  "outputs": {
    "s01": { "queue": "billing" }
  }
}
```

`releasedAt` and `summary` are read only the first time a version appears. Every scenario id must have an entry, with a value for each output field; no entry may name an unknown scenario.

## State and rules that change

- **Failure modes** are still keyed by specialist and theme. Their labels come from the specialist's own themes. A scenario's impact weight replaces its expected severity when suggesting severity.
- **The current state** of a specialist is built from the latest run of each instance for its latest evaluated version. Per scenario, it passes only if it passes in every one of those runs. Triage, the metrics pass rates, scenarios fixed and regressed, and fix verification all use it. Loop time still uses each version's first verdict.
- **The older-version rule** is unchanged: a run of an older version never changes the state.

## Context

- **Users affected**: staff and admin. Agents never see any of it.
- **Dependencies**: everything in Phases 7 to 9 (runner, checks, verdict, judge, metrics, chart, triage, sync, queries, pages, seed, CLI, audit script), the notification and guard helpers, and the `useFormState` pattern already used by the ailment form.
- **Constraints** (from `specs/tech-stack.md`): Prisma only, no raw SQL in app code (the migration backfill is SQL in a migration file); server components and server actions; PicoCSS overrides in `globals.css`; strict TypeScript; `prisma/dev.db` not committed; responsive at 375, 768 and 1280 px with no horizontal scroll or clipped header. SQLite with this Prisma version has no JSON or list columns, so structured data is stored as JSON text and read through validated parsers.
- **Mission fit**: this is the strategy's third scale step ("self-serve: onboarding in a day via config and playbook") and the customer instance program.
- **Risks**:
  - **Refactoring working code.** Mitigated by a characterisation test that compares the generic engine with the existing one on all 32 scenarios for `v1` and `v2` before anything is switched, pinned results throughout, and small groups that keep the app working. The tests that pin the old categories and reasons are rewritten deliberately, each with a reason.
  - **Migration of stored results.** Mitigated by a backfill verified against the existing database, with counts compared before and after.
  - **Untrusted input.** The config and outputs are user-supplied JSON. Mitigated by a size cap, strict schemas, a restricted key pattern (no prototype pollution), field-level limits, text rendered as text, and re-checking everything on the server.
  - **Worst-case across instances** is easy to get subtly wrong. Mitigated by a pure merge function with a table of tests, including a run on a new instance reopening a resolved mode.
  - **Existing databases** have no specialist rows until the seed runs. The README and the empty states say to run the seed after migrating.
  - **Scope.** This is the largest phase. The plan keeps each group shippable on its own and puts the riskiest work (engine, migration) first.
- **Open questions for later**: an instance editor, scenario editing in the browser, deleting and renaming, fuzzy matching, a Team model, and per-instance triage views.
