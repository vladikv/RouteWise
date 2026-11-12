---
name: start-milestone
description: Starts and carries out a planned RouteWise milestone from docs/PLAN.md — creates its branch from an up-to-date main, implements it in Conventional Commits, and closes it (tests, plan tick, decisions log, AI_WORKFLOW entry). Use when the user asks to start, begin or implement a milestone.
---

# Start a milestone

Argument: the milestone name as written in docs/PLAN.md
(e.g. `feat/ui-glass-redesign`).

## 1. Preconditions — stop and report if any fails

1. `git status` is clean. Otherwise ask what to do with the changes;
   never stash or discard them on your own.
2. `git switch main && git pull --ff-only`.
3. On the updated `main`, docs/PLAN.md has the milestone as an
   unchecked `- [ ]` line. If it is missing, the plan change is not
   merged yet, or the feature was never planned (use `add-milestone`).
   If it is already `[x]`, say so and stop.
4. The branch does not exist locally or on `origin`. If it does, ask
   whether to continue on it instead of creating it.

## 2. Create the branch

`git switch -c <milestone-name>` from the updated `main`.

## 3. Prepare

1. Read the milestone entry with its sub-bullets, the related Scope,
   Domain model and API sections and the recent decisions log in
   docs/PLAN.md.
2. Read the `CLAUDE.md` of every module the milestone touches.
3. Post a short work plan: steps in commit order, main files, tests,
   and which subagents do what (`ui-builder`, `test-writer`,
   `backend-reviewer`, or the ones the milestone names).
4. List open questions and any dependency that would be new. Ask and
   wait if one blocks the work; otherwise state the default you take.

## 4. Implement

- Follow the milestone's scope only. Anything extra goes to the user
  as a proposal, not into the code.
- One logical change per commit, with the `commit` skill (scopes
  `api`, `ui`, `ai`, `db`, ...). Run the relevant tests before each
  commit.
- Backend changes get a `backend-reviewer` pass before committing.
- Any API contract change not already described in the milestone is
  stated explicitly to the user before it is made.

## 5. Close the milestone

1. Run everything that applies: `./mvnw verify`, `npm run lint`,
   `npm test`, plus the milestone's own "Done when" items.
   Report results honestly; do not tick a milestone with failures.
2. docs/PLAN.md: tick the milestone, update the sections it changed,
   add notable decisions to the decisions log (today's date).
3. Append the `docs/AI_WORKFLOW.md` entry: milestone, what was
   delegated to AI, what was corrected manually, and why.
4. Commit as `docs: complete <milestone summary> milestone`.
5. Report the branch, the commits and the test results. Pushing,
   the PR and merging are done by a human.
