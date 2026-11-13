# RouteWise

Multimodal trip planner. Users describe a trip (origin, destination, date,
priorities) and RouteWise compares train, bus, car, bike and plane by
travel time, cost and CO₂ emissions. An AI travel advisor parses
free-text trip requests and explains the recommendation, taking the
weather forecast into account.

## Repository layout

```
backend/    Spring Boot REST API (Java 21, Maven)
frontend/   Angular SPA (TypeScript, standalone components)
.claude/    Claude Code agents, skills and hooks
docs/       Architecture notes and decision records
```

Each module has its own `CLAUDE.md` with module-specific rules.
Read it before changing code in that module.

Current scope, domain model, API and progress: `docs/PLAN.md`.
Read it before starting a task; tick the milestone when it is done
and add notable decisions to its decisions log.

## Commands

| Task | Command |
|---|---|
| Run API | `cd backend && ./mvnw spring-boot:run` |
| Test API | `cd backend && ./mvnw verify` |
| Run UI | `cd frontend && npm start` |
| Test UI | `cd frontend && npm test` |
| Lint UI | `cd frontend && npm run lint` |

API: http://localhost:8087 · Swagger UI: http://localhost:8087/swagger-ui.html
UI: http://localhost:4200

## Architecture principles

- Backend is layered: `controller → service → repository`. Controllers never
  touch repositories or entities directly; they exchange DTOs.
- Business rules (mode comparison, CO₂ calculation, scoring) live in the
  service layer and are pure, unit-testable functions where possible.
- External integrations (weather API, LLM provider) sit behind interfaces
  so they can be mocked in tests and swapped without touching services.
- The AI advisor must degrade gracefully: if no API key is configured,
  fall back to the rule-based recommendation. The app must always run
  with zero configuration.
- Database is H2 in-memory; schema is owned by Flyway migrations, never
  by `ddl-auto`.

## Code standards

- All code, comments, commit messages and docs are in English.
- Prefer small, focused classes and methods. No dead code, no commented-out code.
- Validate all input at the API boundary (Bean Validation on request DTOs).
- Errors are returned as RFC 7807 Problem Details via a global handler.
- Every new endpoint or service method gets a test in the same change.
- Never hardcode secrets. Read them from environment variables.

## Git conventions

- Branch per larger feature: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`.
  Small follow-up fixes go to the current branch, not a new one.
- Conventional Commits: `feat(api): add trip comparison endpoint`.
  Scopes: `api`, `ui`, `ai`, `db`, `docs`, `ci`, `tooling`.
- One logical change per commit. Commit messages describe *why* when not obvious.
- Claude creates the milestone branch from an up-to-date `main`
  at the start of each milestone (name taken from docs/PLAN.md;
  use the `start-milestone` skill), stages and commits changes. Claude pushes, opens the PR
  and merges only when the human asks for it in the conversation; otherwise a human does it.

## Working rules for Claude

- Ask before adding a new dependency; explain why it is needed.
- No screenshots: milestones do not require them and reviews work from code and tokens.
- Do not change public API contracts (paths, DTO fields) without saying so explicitly.
- Run the relevant tests after changes and report the result honestly.
- When unsure about a requirement, ask instead of guessing.
- Keep this file and module `CLAUDE.md` files up to date when conventions change.
- After completing a milestone, append a short entry to `docs/AI_WORKFLOW.md`:
  milestone, what was delegated to AI, what was corrected manually, and why.
- Any feature not already in docs/PLAN.md is added as a new milestone
  first (use the `add-milestone` skill) and approved before any code is
  written. Never implement unplanned features "on the way".
