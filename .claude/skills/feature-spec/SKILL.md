---
name: feature-spec
description: Start spec-driven work on the next roadmap phase. Finds the next unfinished phase in specs/roadmap.md, creates a git branch, interviews the user about the feature with AskUserQuestion, then writes a dated spec folder (plan.md, requirements.md, validation.md) under specs/. Use whenever the user says "feature spec", "spec the next phase", "start the next phase", "plan the next roadmap item", "new feature spec", or asks to prepare a branch and spec before implementing a roadmap phase, even if they don't name the skill.
---

# Feature spec

Turn the next roadmap phase into a branch plus a three-file spec, so implementation starts from agreed scope rather than guesses. The interview comes before any file is written because the specs record decisions the user makes; writing first means the user reviews assumptions instead of choosing.

## 1. Orient

Read `specs/mission.md`, `specs/tech-stack.md`, and `specs/roadmap.md`. They set the values, constraints, and conventions the spec must respect (for example responsive breakpoints, test expectations, and where logic lives).

Find the **next phase**: the first phase in `specs/roadmap.md` not marked complete. Roadmap markers can lag reality, so cross-check against existing `specs/YYYY-MM-DD-*` folders and `CHANGELOG.md`. If a phase looks built but unmarked, tell the user and ask whether to treat it as done.

If every phase is complete, say so and ask the user what to spec instead (a roadmap addition or a new idea). Don't invent a phase.

## 2. Branch

Check `git status`. If the working tree is dirty, stop and ask what to do with the changes, since branching over unrelated edits muddles the feature's diff.

Branch from `main` with a short kebab-case name for the feature (for example `phase-6-housekeeping`). If the name already exists, ask rather than reuse it.

## 3. Interview (before writing anything)

Use the **AskUserQuestion** tool. Group questions into exactly these three themes, one call each or combined in a call (max 4 questions per call):

1. **Scope**: what is in and out for this phase; which roadmap bullets to include, defer, or split.
2. **Decisions**: open technical or product choices the roadmap leaves undecided (data model, UI approach, libraries), with a recommended option first and trade-offs in the descriptions.
3. **Context**: who is affected (agents, staff, admins), constraints, dependencies on earlier phases, risks, and anything stakeholders (Mary, Susan, Steve) care about here.

Come prepared: read the relevant code and prior phase specs first so options are concrete and don't re-ask what the repo already answers. Do not write to disk until the answers are in.

## 4. Write the spec

Create `specs/YYYY-MM-DD-feature-name/` using today's date and a kebab-case feature name (match the style of existing folders such as `2026-10-24-phase-4-appointment-booking`). Inside:

- **`plan.md`**: a series of numbered task groups (1, 2, 3...). Each group has a short goal and checkbox tasks small enough to complete and verify in one sitting. Order them so the app stays working after each group, and put tests alongside the code they cover.
- **`requirements.md`**: scope (in and out), decisions made in the interview with the reasoning, and context (users affected, dependencies, constraints from the mission and tech stack).
- **`validation.md`**: how to know the implementation succeeded and can be merged. Make criteria checkable: commands that must pass (`npm test`, `npx tsc --noEmit`, `npm run build`), manual flows to walk through per role, responsive checks at 375, 768, and 1280 px, accessibility expectations, and an explicit merge checklist.

Keep the files consistent: every plan group should trace to a requirement, and every requirement should have a validation check.

## 5. Wrap up

Show the user the branch name and the three file paths with a two-or-three line summary. Don't commit unless asked, and don't start implementing; the spec is the stopping point so the user can review it.
