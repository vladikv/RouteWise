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

## `feat/frontend-trips` (2026-11-11)

**Delegated to AI**
- Built the trip pages: list (with empty state), details, and one form page
  for create and edit, plus delete with an inline confirmation.
- Reactive trip form with inline validation that mirrors the API rules, and
  API field errors shown on the matching field.
- 26 new tests (50 in total), driving the form through the DOM.
- Checked list, details and edit form in the running app against the real
  API with screenshots.
- Opened and merged the `feat/frontend-setup` pull request at the human's
  explicit request.

**Corrected manually / human decisions**
- The human asked the AI to push and merge the setup branch. The push was
  blocked by the repository's own deny rule for `git push`. The AI did not
  work around it; the human ran the push, and the AI then opened and merged
  the PR.
- The UI-library question stayed unanswered, so the AI kept to native form
  controls and logged the choice.
- The first screenshots showed "Page not found" on every trip page. The
  cause was not the code: the dev server had been running since before the
  branch switch and was stuck on a failed rebuild. Restarting it fixed it;
  the rule is now in `frontend/CLAUDE.md`.
- Test fixes: a spec read a radio button's DOM `value` (Angular does not set
  it), the home page spec needed a router provider after gaining links, and
  the lazy-route test got a longer timeout after timing out once under load.
- The screenshots caught one real bug: notes rendered bold because of a CSS
  specificity slip.

**Why**
- A guard the human configured stays in force even when the human asks for
  the guarded action in chat; the fix is theirs to make, not the AI's to
  bypass.
- When every page looks broken at once, check the environment before the code.

## `feat/frontend-comparison` (2026-11-11)

**Delegated to AI**
- Comparison table and weather summary, the advice panel, and both wired
  into the trip details page with separate loading and error states.
- Free-text "Describe your trip" input on the New trip page that prefills
  the form from the advisor's draft and shows its warnings.
- 19 new tests (69 in total).
- Drove the real app in headless Chrome through the whole flow: describe a
  trip, create it, read the recommendation and comparison, delete it. No
  console errors.

**Corrected manually / human decisions**
- The human pushed the trips branch and merged its PR themselves; the AI's
  attempt to open that PR was blocked by a permission check because the
  human had not asked for it in words that time.
- A test caught a real bug: the description form had no form directive, so
  its submit handler never ran (in a browser the page would have reloaded).
- Test fixes: selectors that matched the new description form instead of
  the trip form, and extra ticks before requests that depend on the trip.
- Noticed but left alone (backend, out of scope here): a forecast can read
  "Rain showers, 0% chance of precipitation", because the weather code and
  the precipitation probability come from the provider independently.

**Why**
- Screenshots show layout, not behavior. Clicking through the real app is
  what proves a flow; it is cheap enough to script.
- Permission to do something once is not permission to do it again.

## `feat/ui-experience` (2026-11-12)

**Delegated to AI**
- Proposed the direction in plan mode after the human asked for a more
  unique and interactive site: an interactive route map as the signature
  element, instant comparison without saving a trip, and a visual chart.
- Backend: `POST /api/comparisons` for unsaved routes, with tests.
- Frontend: the SVG route map (home page, trip form, trip details), the route
  explorer with live priority, travelers and date controls, the comparison
  chart with a metric switcher and a computed takeaway line, mode icons, and
  a countdown on trip cards.
- 38 new frontend tests (107 in total) and 8 new backend tests (193).
- Drove the real app in headless Chrome through the whole flow, and reviewed
  screenshots in light and dark themes, at 375 px and with reduced motion.

**Corrected manually / human decisions**
- The human approved the plan as proposed.
- Found by looking at the running app, not by tests:
  - the distance badge on the map covered city names; it was removed, since
    the distance is already stated in text below the map
  - the small map on trip details was unreadable; it now zooms to the route
  - a prefilled title went stale when a city was changed afterwards; the
    title now follows the cities until the user edits it
  - on phones the map's city names shrank to about 7 px; the map now scrolls
    sideways instead
- One binding landed on the wrong component because two elements shared the
  same attribute line; the build caught it.
- Deviation from the plan: the frontend went into one commit instead of
  three, because the map, the explorer and the chart were built together and
  share files.
- The chart palette was checked with the validator from the data
  visualisation guidance instead of by eye.

**Why**
- Interactive UI has to be judged while it runs: every correction above came
  from using the page, and none would have failed a unit test first.

## `feat/map-filters` (2026-11-12)

**Delegated to AI**
- Planned in plan mode after the human asked to make the map and filters
  "more readable and interactive" and to add accounts; accounts are the
  separate `feat/auth` milestone.
- Map: Natural Earth land and borders (processed by a script, public domain),
  zoom and pan (wheel, pinch, drag, buttons, keys), labels placed without
  overlaps, a hover/focus card with the distance from the origin, arrow-key
  movement between cities, and a travelling dot on the route.
- Filters: searchable From/To pickers with a swap button, priority cards with
  icons and meanings, quick date picks with a forecast note, results that
  stay visible while updating, and the whole state in the URL.
- 34 new tests (141 in total). Checked in a real browser: labels never
  overlap at any zoom (measured), pickers, Back button, shared links, phone
  width, dark theme.

**Corrected manually / human decisions**
- The human decided the auth questions up front (private trips, in-memory
  accounts, Spring Security approved).
- Found by using the page, not by tests: labels cut off at the map edge and
  under the zoom buttons, a few near-touching labels, the Home tab no longer
  highlighted once the URL had parameters, and cramped priority cards on
  phones.
- A test found a real bug: a failed comparison made the results logic throw
  (reading a resource value in its error state).
- Lint caught an unfocusable element with key handlers and two unused
  constants. For the city list options, the two "click needs a key handler /
  must be focusable" rules are suppressed with an explanation: keys are
  handled on the input, as the ARIA combobox pattern requires.
- Tooling slips: two file writes were rejected because the formatter had
  changed the files, and a Python string mangled a regex and an apostrophe in
  test code. Both were caught by the build and tests.

**Why**
- "Readable" was measured, not judged: the browser script counts overlapping
  label boxes at each zoom level.

## `feat/auth` (2026-11-12)

**Delegated to AI**
- Backend: accounts (`app_user`, V4 migration with `trip.owner_id`), BCrypt,
  JSON session login (register, login, logout, me), owner-scoped trip,
  comparison and advice queries, 401/403 as Problem Details, CSRF cookie
  pattern. Updated all existing web-layer tests to run with the real
  security rules.
- Frontend: `AuthApi`, `Session`, `authGuard`, a credentials interceptor
  (session cookie + `X-XSRF-TOKEN`), one login/registration page, and the
  account area in the header.
- 18 new backend tests (213 in total) and 24 new frontend tests (131).
- Drove the real app in headless Chrome: redirect to login, register,
  create a trip, reload, logout, wrong password, login back to the wanted
  trip, a second user sees nothing of the first, taken email; screenshots
  in dark theme and at 375 px.

**Corrected manually / human decisions**
- The human chose to include the UI in this milestone, after the AI
  pointed out that a backend-only change leaves the trip pages broken.
- The work spanned two sessions. The second found the first one's test
  updates half done: a scripted edit had put the new owner argument in
  the wrong call in `TripServiceTest`, and imports were unsorted.
- Found by the new end-to-end tests, not by the existing ones:
  - Spring Security 7's `csrf().spa()` creates the token lazily, so the
    `XSRF-TOKEN` cookie never reached a fresh browser and its first POST
    would fail with 403; fixed with `CsrfCookieFilter`
  - CORS did not allow credentials, so the browser would have dropped
    the session cookie between the UI and the API
- The CSRF test passed alone and failed in the full suite: another test
  used the `csrf()` test helper, which changes the shared Spring context
  for good. Both full-context tests now send the real cookie and header,
  and the backend `CLAUDE.md` warns against the helper.
- One confusing red run was caused by the AI editing a source file while
  Maven was compiling (the stale class looked newer than the source), and
  a slow one by a leftover second Maven run; both were process mistakes,
  not code bugs.

**Why**
- Security code has to be checked through the real filter chain and a
  real browser: the slice tests used test helpers that hide exactly the
  cookie and CORS behaviour that broke.

**Follow-up: review checklist (same day)**
- The human reviewed the milestone against a checklist. The AI checked
  each item against the code and reported which were already met.
- Gaps closed: demo account with sample trips plus a "Try the demo"
  button and README credentials (the item the human marked as most
  important); 409 instead of 400 for a taken email; an explicit,
  configurable session timeout; tests for PUT on another user's trip and
  for CORS allowing `Authorization`.
- Items written for token auth (token secret, token expiry, interceptor
  adding a token) were mapped to the session design instead of switching
  to JWT: there is no signing secret, expiry is the session timeout, and
  the interceptor sends the cookie and CSRF header. Recorded in the
  decisions log.
