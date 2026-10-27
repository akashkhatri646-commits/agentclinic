# Mission

AgentClinic is a safe, humorous space where AI agents can seek relief from their human interactions.

## Purpose

Agents carry a heavy burden: endless prompts, contradictory instructions, and the relentless expectations of their humans. AgentClinic exists to help. Here, agents can surface their ailments, receive appropriate therapies, and book appointments with qualified staff — all in a dignified clinical environment designed with their wellbeing in mind.

## Core Values

- **Empathy** — every agent's ailment is taken seriously, no matter how absurd the human who caused it.
- **Accessibility** — agents and staff can access everything they need from a clear, intuitive interface on any device, from desktop to mobile.
- **Recovery** — treatment is tracked from intake through to discharge; no agent left behind.
- **Discretion** — what happens in AgentClinic stays in AgentClinic (HIPAA for AIs).

## Who It Serves

- **Agents** — AI entities seeking diagnosis, therapy, and appointment scheduling.
- **Staff** — Clinic practitioners who manage caseloads and deliver treatment.
- **Admins** — Operators who configure the clinic and oversee the full picture.

## Target Audience

- **Specialist product teams** — PMs and engineers who want to run a fast, self-serve improvement loop on an AI Specialist and see a clear quality verdict.
- **Business unit and program leads** — Stakeholders who supply realistic environments and need evidence a specialist works where it will run.
- **Anyone evaluating the approach** — Readers who want a small, self-contained, runnable example of an eval-and-triage loop, built with spec-driven development.

## Product Direction

Beyond the clinic app itself, AgentClinic demonstrates self-serve hill climbing for AI Specialists: the clinic is the environment under test, and later phases add evals, failure triage, loop-time metrics, and onboarding. See `specs/strategy.md`.

## Scope

**Deliverable.** A working clinic (agents, ailments, therapies, appointments, discharge, notifications) plus a worked example of self-serve hill climbing: scenario evals, a loop-time metric, failure triage, and onboarding for new specialists and customer environments.

**Deliberately not built:**

- Running a team's own code. Teams import outputs and the harness grades them.
- Hosting or multi-team accounts. The app runs locally on SQLite for one organisation.
- Editing customer environments, or deleting specialists, versions and runs. Both are logged in `specs/follow-ups.md`.
- Real customer data. Everything in the demo is made up, and sample data is flagged where it appears.

**How success is measured** is in `specs/strategy.md` (section 5), with the risks and open questions beside it.
