# Playbook: onboard an AI specialist onto the hill-climbing loop

This is for a team that owns an AI specialist and wants to run the improvement loop on it without anyone from the core team in the room. It takes about a day the first time. Each step says what you do, what you get, and what usually goes wrong.

The loop: **write scenarios, get a verdict, find the failure modes, fix the biggest one, prove the fix with a later run.** The app tracks where you are on the Onboarding page, from what you have actually done.

You need a staff or admin account. You will be the **owner** of the specialist you create: only you or an admin can change it or import its outputs, and anyone on staff can look.

---

## 1. Choose a starting point

Open **Specialists → New specialist**. The text box is pre-filled from a template. Pick another from the list if it fits better.

| Template | Use it when |
|---|---|
| Classification starter | Your specialist returns one label. Twelve scenarios, two themes, a hold-out set. The usual first choice. |
| Intake triage (worked example) | You want to see every feature: several output fields, three kinds of check, 32 scenarios in 10 themes, a judge. |
| Blank starter | You know what you are doing. The smallest valid config. |

Change `slug` (the address, lowercase with hyphens) and `name` before saving. Nothing is saved until the whole document is valid, and every problem is listed with its exact place.

## 2. Say what your specialist returns and how to check it

```json
"outputFields": [{ "name": "queue", "description": "The queue the ticket belongs in." }],
"checks": [{ "field": "queue", "type": "equals" }]
```

An **output field** is one thing your specialist returns. Up to 10, each a short name that starts with a letter.

A **check** decides whether a field is right:

| Check | Passes when | Example |
|---|---|---|
| `equals` | the value equals what the scenario expects | the category is `billing` |
| `oneOf` | the value is one of a fixed set (`values`) | the level is `low`, `medium` or `high` |
| `inReference` | the value is in a list the environment provides (`list`) | the therapy exists in this clinic's catalogue |
| `nonEmpty` | the value is not blank | a rationale was given |

A scenario passes only if **every** check passes. Values are compared as text, after trimming, and are case-sensitive.

Optionally add `"judge": { "field": "rationale" }` to have an LLM score that text field (1 to 5; below 3 fails). It only looks at answers that already passed the checks, and a judge that is down never fails a scenario.

## 3. Write good scenarios

A scenario is an input and the answer you expect.

```json
{ "id": "d07", "split": "DEV", "theme": "edge-cases", "weight": 3,
  "input": "Not a billing problem: the box arrived crushed.",
  "expected": { "queue": "shipping" },
  "why": "The word 'billing' is negated; the complaint is damage in transit." }
```

- **Split.** `DEV` scenarios are what you iterate against. `HOLDOUT` scenarios you do **not** tune against: they exist to expose overfitting. Keep at least 2 held out and at least 6 scenarios overall, and do not look at the hold-out failures while fixing.
- **Theme.** The weakness the scenario probes, such as "negation" or "sarcasm". Failing scenarios are grouped by theme, and each theme becomes one **failure mode** you can fix. Themes about causes beat themes about topics.
- **Weight.** 1 to 3: how much a failure matters. The highest weight among a mode's failing scenarios becomes its suggested severity.
- **Why.** One line on why the expected answer is right, so a reviewer can challenge it. Write it; it is the cheapest quality control you have.
- Aim for scenarios from **real failures**, not ones your specialist already passes. A set it passes at 100% tells you nothing.

You can add scenarios later (**Edit definition**). Once the specialist has runs you can add and reword but not remove or rename a scenario, field, theme or check, move a scenario between dev and hold-out, or change its theme: existing results depend on them.

## 4. Run your specialist, then import what it returned

The harness never runs your specialist. You run it wherever it lives, on every scenario, and bring back the answers. Nothing is executed or fetched from your side.

Open the specialist and press **Import outputs**. The text box lists every scenario and field with an empty value:

```json
{ "format": "agentclinic.outputs/1",
  "version": "v1",
  "releasedAt": "2026-10-20T09:00:00Z",
  "summary": "First draft.",
  "outputs": { "d01": { "queue": "billing" }, "d02": { "queue": "shipping" } } }
```

- **`version`** is the label of what you are testing. A new label registers a new version.
- **`releasedAt`** is required for a new version: the time the change **shipped**. This is where loop time starts, so use the real time. Versions are ordered by it, and a new one must be later than the last and not in the future.
- **`summary`** is a line on what changed. It is shown on the verdict.
- Every scenario must be present, and no extra ones. Every field must have a value.
- **Customer instance.** Pick the environment the answers were produced against. Use the same label with another instance to test the same version somewhere else.

You get a **verdict**: PASS needs a dev pass rate of at least 85% and a hold-out rate within 10 points of dev. A large gap means the specialist was tuned to the dev scenarios.

## 5. Read the verdict

Open the run. It shows pass rates, what changed against the previous version on the same instance (fixed and regressed scenarios), and a table of failures with expected and actual values and **why each failed**. The Metrics page shows the loop time (release to first verdict) and the trend across versions.

## 6. Triage: pick what to fix

The **Triage** page groups failures into failure modes and ranks them by **frequency × severity ÷ effort**. Frequency comes from the run; severity is suggested from the weights and you can override it; set the effort (S, M, L) honestly, since a big job lowers a mode's rank.

Open the top mode and **propose a fix** with a title and an owner. Move it to **in progress** when work starts, and to **shipped** with the version that contains it.

## 7. Prove the fix

Make the change, then import the outputs of the version that contains it (a new label, a later `releasedAt`). When that run passes every scenario of the fix's failure mode, **the fix becomes verified automatically** and its owner is notified. Nobody can mark a fix verified by hand: only a run is evidence.

If a verified mode fails again, it reopens and is flagged as reappeared. A scenario that passed in the previous version and fails now is flagged as regressed.

That is one turn of the loop. The Onboarding page ticks as you go, and counts you as **onboarded** once you have a verdict and a verified fix.

---

## Customer instances: test on a spread

A specialist that works in one environment may fail in another. The app has several **customer instances**: environments with their own reference lists, such as a clinic that is missing a therapy or one that renamed its therapies. Run the built-in specialist on one instance or on all of them from **Evals**, or import outputs for the instance you tested.

Triage and metrics take the **worst case across instances**: a scenario counts as failing if it fails on any instance that has a run of the current version, and a fix is verified only when it works on all of them. Pages say which instances they used, and a failure mode says which instance's run last changed it.

## What "unassisted" means

On the Metrics page, **unassisted** is the share of onboarded specialists where no admin other than the owner acted before the first verified fix. Creating, changing, importing, running and moving fixes all count as acting. It is a proxy for "the team ran the loop on its own", not a measure of quality.

## Common errors

| You see | It means | Fix |
|---|---|---|
| `format must be "agentclinic.specialist/1"` | The `format` line is missing or wrong. | Add or correct it. |
| `scenarios[3].theme "biling" is not one of the themes` | A scenario names a theme you did not define (the message lists the real ones). | Fix the spelling, or add the theme. |
| `checks[1].field "quee" is not one of the output fields` | A check names a field that does not exist. | Fix the field name. |
| `scenarios[0].expected.queue is required because queue is checked with "equals"` | A scenario has no expected value for an `equals` field. | Add it. |
| `scenarios needs at least one scenario with split DEV` | Every scenario is hold-out. | Mark some as `DEV`. |
| `weight must be 1, 2 or 3` | Weight is out of range. | Use 1, 2 or 3, or leave it out. |
| `The config is 230 KB, over the 200 KB limit` | Too large. | Up to 200 scenarios, 2,000 characters each. |
| `outputs is missing 2 scenarios: d03, h04` | The outputs file does not cover every scenario. | Add them; the skeleton on the import page lists all. |
| `outputs.zz9 is not a scenario of this specialist` | An entry for a scenario that does not exist. | Remove it. |
| `releasedAt is required the first time a version is imported` | A new version label with no release time. | Add the time the change shipped. |
| `releasedAt must be after the release of v1` | Versions are ordered by release time. | Use the real, later time, or a different label. |
| `scenario "d01" is used by existing runs and cannot be removed or renamed` | The specialist already has runs. | Add instead of removing, or create a new specialist. |

## For the core team

This playbook, the templates and the validation messages are the self-serve surface. If a team gets stuck on a step, that is a defect in the playbook or the product, not in the team: fix it there, and the **unassisted** share is how you will see whether it worked.
