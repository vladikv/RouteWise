---
name: add-milestone
description: Adds a new feature to docs/PLAN.md as a milestone (scope, domain model, API, definition of done, decisions log) before implementation. Use whenever the user asks for a feature that is not in the plan.
---

# Add a milestone

1. Read docs/PLAN.md fully. Check the feature isn't already covered
   by an existing milestone; if it is, say so and stop.
2. Analyse the impact on existing code: which entities, migrations,
   endpoints, DTOs and UI screens change. Flag breaking API changes.
3. Update docs/PLAN.md:
  - **Scope**: add the feature (remove it from "Out of scope" if listed)
  - **Domain model**: new/changed entities and fields
  - **API**: new/changed endpoints, marked as changed where relevant
  - **Milestones**: a new line `feat/<kebab-name>: <one-line goal>`,
    placed after the milestones it depends on
  - **Definition of Done**: new items only if the feature needs them
  - **Decisions log**: date, decision, reason (why it is worth adding)
4. Show the diff of docs/PLAN.md and wait for approval.
5. After approval, commit it with the `commit` skill
   (`docs(plan): add <feature> milestone`). Do not start implementation;
   that is done with the `start-milestone` skill.
