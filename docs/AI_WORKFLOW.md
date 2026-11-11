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
