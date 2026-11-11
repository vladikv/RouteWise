# AI Workflow Log

One entry per milestone: what was delegated to AI (Claude Code), what was
corrected manually, and why.

## `feat/backend-setup` (2026-11-11)

**Delegated to AI**
- Generated the project from start.spring.io via curl (Boot 4.1.2, Java 21,
  web, data-jpa, h2, flyway, validation, lombok), removed `HELP.md`.
- Added springdoc-openapi 3.2.0, `application.yml` (H2 in-memory, Flyway,
  `ddl-auto=validate`, `open-in-view=false`, H2 console, CORS property).
- Wrote `CorsConfig`/`CorsProperties`, `OpenApiConfig`, the
  `RouteWiseException` hierarchy and the Problem Details `GlobalExceptionHandler`.
- Wrote `@WebMvcTest` tests with a test-only controller (404, 400 field
  errors, malformed JSON, 500 without internals) and CORS preflight tests.
- Wrote `backend/CLAUDE.md`.
- Ran `./mvnw verify` and checked by hand that the app starts and that
  Swagger UI, `/v3/api-docs` and the H2 console are reachable.

**Corrected manually / human decisions**
- The plan was reviewed and approved before any code was written.
- Port 8080 was taken by an unrelated local service, so the startup check
  ran on port 8081 (`--server.port=8081`). No code change was needed.

**Why**
- Boot 4 split auto-configuration into modules (`spring-boot-h2console`,
  `spring-boot-starter-webmvc-test`, ...). Generating the project from
  Initializr instead of writing the pom by hand got those module names right.

## `feat/backend-trips` (2026-11-11)

**Delegated to AI**
- Proposed the plan; the human chose seed scope (25 European cities),
  the trip response shape (nested city summary) and the travelers limit (1–9).
- Wrote Flyway migrations V1–V3 (reference tables, seed data, trip table
  with FKs and CHECK constraints), the `city`, `transportmode` and `trip`
  feature packages, and `FieldValidationException` for business-rule 400s.
- Wrote 35 new tests: service unit tests, `@WebMvcTest` per controller,
  and a `@DataJpaTest` against the real Flyway schema.
- Ran the API on port 8081 and exercised create/read/update/delete with curl.

**Corrected manually / human decisions**
- The `@DataJpaTest` inserts failed with "Check constraint invalid". The
  AI first assumed Hibernate's native enum binding was at fault and added
  `@JdbcTypeCode(VARCHAR)`. That did not help, so it was reverted. Tracing
  the nested cause ("database has been closed") and reproducing with plain
  JDBC showed an H2 2.4.240 bug. The human approved pinning H2 to 2.3.232.
- The backend-reviewer flagged that `@FutureOrPresent` on the shared request
  DTO made past trips uneditable. The human chose "allow if the date is
  unchanged", so the rule moved into `TripService` (with an injected `Clock`).
- The first unit-test draft mocked the `City` entity; replaced with a
  `TestCities` fixture that builds real instances.

**Why**
- The first fix guessed from a single symptom; reading the full exception
  chain and building a minimal reproduction found the real cause in minutes.
  Worth doing before changing code next time.
- Dependency version changes stay a human decision (root CLAUDE.md).
