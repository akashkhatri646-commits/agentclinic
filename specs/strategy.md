# Strategy: Self-Serve Hill Climbing for AI Specialists

> Status: **proposal**. Phases 1–6 describe what is built (or in progress). Phases 7–10 are planned and not yet implemented. See `specs/roadmap.md` for delivery status.

## 1. Problem

AI Specialists improve through a loop: test against realistic environments, find what fails, fix it, test again. Today that loop has three weaknesses:

1. **Slow.** From a shipped change to a trustworthy quality verdict takes weeks, so teams ship several changes blind.
2. **Expert-gated.** Running the loop well needs a central team that knows how to build scenarios, read failures, and judge results. It does not scale past a few specialists.
3. **Findings don't become fixes.** Eval output is a report, not a prioritized backlog with an owner who stays until the fix ships.

## 2. Vision

Any specialist product team can run its own hill-climbing loop in days, on realistic environments, with defaults good enough that they rarely need the central team.

AgentClinic is the **worked example**: a self-contained clinic domain (agents, ailments, therapies, appointments) that serves as the environment under test, plus the tooling that closes the loop around it.

## 3. Domain mapping

The clinic metaphor is deliberate. It keeps the demo self-contained and memorable, and it maps one-to-one onto the loop.

| Clinic concept | Hill-climbing concept |
|---|---|
| Ailment | Failure mode found in eval |
| Triage / diagnosis | Error analysis and categorization |
| Therapy | Prioritized fix (prompt, tool, guardrail, policy) |
| Appointment | Scheduled eval run or fix slot |
| Discharge (Phase 6) | Fix verified and regression-gated |
| Treatment history | Quality trend across specialist versions |

## 4. Personas

| Persona | Needs | Success looks like |
|---|---|---|
| **Specialist product team** (PM + eng) | Know quickly whether a change helped; a ranked list of what to fix next | Runs a loop without help; ships fixes weekly |
| **Business unit lead** | Evidence the specialist works in their real environment; a way to contribute instances | Sees quality trend; approves instance access |
| **Hill-climbing program owner** (this role) | Scale across teams without becoming a bottleneck | Share of teams running unassisted rises; loop time falls |

## 5. Success metrics

North star: **median loop time from shipped change to actionable verdict** (target: weeks → days).

| Metric | Why it matters | Initial target (pilot) |
|---|---|---|
| Loop time (change → verdict) | Core speed outcome | < 3 days |
| Findings converted to shipped fixes (%) | Evals only matter if they change the product | > 60% of P1/P2 within 2 sprints |
| Teams running unassisted (%) | Proves the method scales without us | 3 of 5 pilot teams by end of pilot |
| Real-instance coverage (% of specialists tested on a customer-shaped environment) | Tests where it actually runs | Every priority specialist has ≥ 1 instance |
| Regressions caught pre-release | Trust in the verdict | Tracked; goal is a rising catch rate |

Targets are placeholders to be calibrated against a measured baseline in the pilot.

## 6. Scope and non-goals

**In scope:** an eval harness and verdicts, failure triage into a ranked fix backlog, loop-time and quality-trend metrics, self-serve onboarding, and a customer-instance program.

**Non-goals (for now):**
- Building or hosting the specialists themselves.
- A general-purpose ML experiment tracker.
- Automated fixing. The system recommends and prioritizes; humans decide.
- Handling real customer data. Demo environments are seeded and synthetic.

## 7. Roadmap and rationale

| Phase | Theme | Status | Why in this order |
|---|---|---|---|
| 1–5 | Clinic app: auth, agents, ailments, therapies, booking, dashboard | Complete | Builds the realistic environment under test |
| 6 | Discharge, notifications, hardening | In spec | Closes the intake→discharge loop; it is the "fix verified" state later phases reuse |
| 7 | **Eval harness**: golden scenarios, runner, deterministic + LLM-judge checks, quality verdict | Planned | Without a trustworthy verdict nothing else matters |
| 9 | **Loop-time and quality metrics**: change→verdict timing, pass rate per version, regression flags | Planned | Makes the north star measurable early, so progress is provable |
| 8 | **Failure triage**: cluster failures, score by frequency × severity × effort, ranked fix backlog | Planned | Turns verdicts into action |
| 10 | **Self-serve onboarding**: bring-your-own-specialist config, default eval templates, guided setup, playbook | Planned | Last, because defaults should come from patterns learned in 7–9 |

Phase 9 is sequenced before 8 on purpose. A measured baseline is the cheapest high-signal evidence, and triage design benefits from real verdict data.

### Scale path

1. **Pilot (1 team):** run the loop with hands-on support; instrument everything; establish the baseline.
2. **Expand (3–5 teams):** reuse templates; support becomes office hours; each team adds scenarios back to a shared library.
3. **Self-serve (all priority specialists and beyond):** onboarding in a day via config and playbook; central team owns defaults, instance program, and the metrics review.

## 8. Customer instance program

Evals are only as good as the environments they run in. Proposal:

- Each business unit nominates a sanitized instance shaped like production (data volume, workflows, integrations, permissions).
- A standard intake checklist covers data handling, access, refresh cadence, and ownership.
- Instances are tagged by shape so a specialist can be tested on a spread of environments, not one favorite.
- In the demo, this is represented by multiple seeded clinic configurations selectable at run time.

## 9. Operating model and stakeholders

| Stakeholder | Role | Ask |
|---|---|---|
| Specialist product teams | Run loops, own fixes | Commit to a weekly loop and to triaging the ranked backlog |
| Engineering | Harness reliability, fix delivery | Capacity reservation for P1 fixes |
| Business units | Supply instances, validate relevance | Nominate instance owners |
| Program owner | Roadmap, defaults, metrics, follow-through | Stay with each fix until it ships |

Cadence: weekly metrics review; per-team loop check-in; monthly cross-team readout of top failure patterns.

## 10. Risks

| Risk | Mitigation |
|---|---|
| LLM-judge verdicts are noisy or biased | Pair with deterministic checks; calibrate against human-labelled samples; track judge agreement |
| Teams treat evals as a gate, not a tool | Default to advisory mode; show the trend, not just pass/fail |
| Instance data is sensitive | Sanitization standard; synthetic-first; no raw customer data in the harness |
| Scenario sets overfit (hill climbing the test) | Hold-out scenarios; rotate in new real-world failures each cycle |
| Central team becomes the bottleneck | Self-serve is a roadmap phase and a metric, not an afterthought |

## 11. Open questions

- Which judging approach gives the best cost/trust tradeoff at volume?
- What is the minimum viable scenario set for a team to get a useful verdict?
- How should shared scenarios be governed across teams?
- Which specialists form the first pilot?

## 12. Method note

This repo is built with spec-driven development using an AI coding agent: constitution, then per-phase specs, then implementation. `prompts.md` and `CHANGELOG.md` record the process.
