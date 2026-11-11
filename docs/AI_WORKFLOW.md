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

## `feat/backend-comparison` (2026-11-11)

**Delegated to AI**
- Proposed the engine design: detour factors, priority weights, normalisation
  and weather rules. The human chose that weather adjusts scores, that both
  cities' forecasts count, and 5 seats per car.
- Wrote the `weather` feature: an Open-Meteo client behind `WeatherClient`,
  timeouts, and a best-effort `WeatherService` that queries both cities in
  parallel on virtual threads. Also wrote the `comparison` feature: a pure
  `ComparisonEngine` plus `GET /api/trips/{id}/comparison`.
- Wrote 36 tests: engine maths, weather hazard rules, the HTTP client against
  `MockRestServiceServer` (including timeouts), the service and the controller.
- Verified end to end against live Open-Meteo, and with an unreachable
  provider (comparison still 200, weather empty, warnings logged).

**Corrected manually / human decisions**
- Boot 4 has no `RestClient.Builder` without `spring-boot-starter-restclient`.
  The AI asked before adding it, and the human approved.
- Two engine tests had wrong expectations (a near-tie between TRAIN and BUS,
  and assuming the bike wins a short GREENEST trip, although the bus is
  greener once time counts). The AI recomputed the scores by hand from the
  seed values and rewrote the tests to assert unambiguous properties. The
  engine itself was unchanged.

- The backend-reviewer found no blockers. Fixed after review:
  - ranking used the rounded score, so 61.4 could lose to 60.6 on enum order;
    it now ranks by the raw score
  - nothing proved the HTTP timeouts were applied; added a test against a
    local slow server and confirmed it fails when `setReadTimeout` is removed
  - the scoring tests were relative only; added hand-computed literal scores
  - added `@Validated` weather properties, plus tests for a 400 on a
    non-numeric id, unexpected client errors and the mapper
  - `backend/CLAUDE.md` layout updated for the `client/` and `config/`
    subpackages

**Why**
- Expected values in scoring tests must be derived from the formula, not
  from intuition. Near-ties make brittle tests.
- A test that would still pass with the code removed proves nothing; a quick
  mutation check is cheap insurance for configuration code.

## `feat/ai-advisor` (2026-11-11)

**Delegated to AI**
- Designed and built the advisor feature: `POST /api/advisor/parse` (free text
  to a checked trip draft) and `GET /api/trips/{id}/advice` (explains the
  weather-aware recommendation).
- `ClaudeAdvisorClient` on the Anthropic Java SDK. It uses structured outputs,
  `claude-opus-5-5` at effort `low`, and server-side refusal fallback. The
  bean is created only when `ANTHROPIC_API_KEY` is set.
- Rule-based fallback: `RuleBasedTripParser` handles cities with local
  spellings and diacritics, absolute and relative dates, party size and
  priority keywords. `RuleBasedAdviceWriter` gives the recommendation, the
  best alternative and the weather. `TripDraftResolver` validates every
  extraction, from the AI or from the rules.
- 90 tests, including a fake Messages API on a local `HttpServer` and a
  zero-config `@SpringBootTest`.
- Verified end to end with zero configuration against live Open-Meteo.

**Corrected manually / human decisions**
- The human chose the official SDK over raw `RestClient` calls, when asked
  before the dependency was added. `backend/CLAUDE.md` now records this as
  the one exception to the `RestClient` rule.
- The AI expected the SDK to send `x-api-key`. The fake server showed that
  SDK 3.3.0 sends `Authorization: Bearer <key>`. The AI checked that it was
  the configured key, not an ambient credential, and fixed the test.
- One parser test expectation was wrong ("Paris, then back to Paris": the
  `to` marker makes Paris the destination). The AI replaced it with an
  unambiguous case.
- The backend-reviewer found no blockers. Fixed after review:
  - inconsistent traveler counting ("me and 2 friends" gave 2, "2 adults
    and 2 kids" gave 2)
  - "Friday next week" resolved to today + 7
  - "may" as a verb was read as the month
  - no length cap on AI advice
  - missing tests: zero-config wiring, `AdviceFacts`, `max_tokens`,
    malformed JSON, missing text block
  - the absence of a rate limit is now recorded as a v1 decision
- No live Claude call was made. No API key was available, and calls cost
  money. The real request shape, especially the `fallbacks` beta, is
  verified only against the fake server.

**Why**
- LLM output is untrusted input. Validating it with the same resolver as the
  rules keeps one definition of a valid draft. Letting the engine own the
  recommendation means the AI can explain it but never change it.
- A fake HTTP server catches wire-level surprises, such as the auth header,
  that a mocked interface hides.

## `feat/frontend-setup` (2026-11-11)

**Delegated to AI**
- Scaffolded the Angular 22 app with the CLI and added angular-eslint.
- Built the typed API layer: models mirroring the backend DTOs, one service
  per resource, and an interceptor that turns Problem Details into `ApiError`.
- Built the shell (skip link, header, footer), the light/dark theme with
  design tokens, shared spinner and error components, and a home page that
  loads the transport modes from the API with loading, empty and error states.
- 24 tests. Checked the running app against the real API with headless
  Chrome screenshots at desktop and 375 px width.
- Wrote `frontend/CLAUDE.md`.

**Corrected manually / human decisions**
- The human dismissed the question about UI library and dev tools and asked
  to continue. The AI therefore took the most conservative path: no UI
  library, only the tools the repository already referenced (ESLint for
  `npm run lint`, Prettier for the format hook), and no root `dev` script.
  These remain open for the human to change.
- One test hung: it awaited `whenStable()` while its own unanswered request
  kept the app unstable. The AI fixed the test sequencing and recorded the
  rule in `frontend/CLAUDE.md`.
- The first phone-width screenshot looked broken. It was a capture artifact
  (headless Chrome's minimum window width), confirmed with a true 375 px
  iframe. The real check still led to two fixes: an icon-only theme toggle on
  phones and a keyboard-focusable scroll region for the table.

**Why**
- Unit tests cannot show layout. A screenshot of the real page, at the real
  width, is the cheapest way to catch what they miss; and a suspicious
  screenshot needs checking before it is trusted either way.
- Choices the human has not made stay reversible and are logged as open.
