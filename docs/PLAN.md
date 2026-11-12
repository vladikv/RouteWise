# RouteWise — Development Plan

Living document. Claude reads it before starting work and updates
checkboxes when a milestone is completed.

## Scope (v1)
- Create, view, edit and delete saved trips
- Compare transport modes for a trip by time, cost and CO₂
- Weather-aware recommendation for the departure date
- AI travel advisor: free-text trip request → trip draft + explanation
- Works with zero configuration (rule-based fallback without an AI key)
- Accounts (email + password, session login); saved trips are private to their owner
- Demo account with sample trips (`demo@routewise.app` / `demo1234`), one click on the login page

Out of scope for v1: social login, password reset, email verification,
real-time timetables, booking.

## Domain model

**AppUser**: account
`id, email (stored lower-case, unique), passwordHash (BCrypt), displayName, createdAt`

**City**: seeded reference data
`id, name, country, latitude, longitude`

**TransportMode**: seeded reference data
`code (TRAIN|BUS|CAR|BIKE|PLANE), avgSpeedKmh, costPerKm, co2GramsPerKm, fixedOverheadMinutes, maxDistanceKm`

**Trip**: user-owned, full CRUD, visible only to its owner
`id, ownerId, title, originCityId, destinationCityId, departureDate, travelers, priority (FASTEST|CHEAPEST|GREENEST|BALANCED), notes, createdAt, updatedAt`

**Comparison**: computed, not stored
Per mode: `durationMinutes, totalCost, co2Kg, score, recommended`.
Distance = haversine between cities × road/rail factor.

## API

Public: cities, transport modes, `POST /api/comparisons` and the auth endpoints.
Everything else needs a login (401 otherwise); another user's trip answers 404.
Changing requests need the `X-XSRF-TOKEN` header echoing the `XSRF-TOKEN` cookie.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create an account and log in (201; 409 if the email is taken) |
| POST | `/api/auth/login` | Log in; starts a session |
| POST | `/api/auth/logout` | End the session (204) |
| GET | `/api/auth/me` | The logged-in account (401 when logged out) |
| GET | `/api/trips` | List your trips |
| GET | `/api/trips/{id}` | Trip details |
| POST | `/api/trips` | Create trip (201 + Location) |
| PUT | `/api/trips/{id}` | Update trip |
| DELETE | `/api/trips/{id}` | Delete trip (204) |
| GET | `/api/trips/{id}/comparison` | Mode comparison + recommendation |
| POST | `/api/comparisons` | Compare a route without saving a trip (same response, `tripId` null) |
| GET | `/api/trips/{id}/advice` | AI/rule-based advice incl. weather |
| POST | `/api/advisor/parse` | Free text → trip draft |
| GET | `/api/cities` | Cities for autocomplete |
| GET | `/api/transport-modes` | Mode parameters |

## External services
- **Open-Meteo**: weather forecast, no API key required
- **LLM provider**: optional Claude (Anthropic) via `ANTHROPIC_API_KEY`; behind an
  `AdvisorClient` interface, with rule-based parsing/advice as fallback

## Milestones

- [x] `chore/ai-dev-setup`: CLAUDE.md, subagents, skills, hooks
- [x] `feat/backend-setup`: Spring Boot scaffold, H2, Flyway, error handling, OpenAPI, CORS
- [x] `feat/backend-trips`: City/TransportMode seed data, Trip CRUD + tests
- [x] `feat/backend-comparison`: comparison engine + weather integration + tests
- [x] `feat/ai-advisor`: advisor parse/advice endpoints with fallback + tests
- [x] `feat/frontend-setup`: Angular scaffold, layout, API client, theming
- [x] `feat/frontend-trips`: trip list, form, details, delete
- [x] `feat/frontend-comparison`: comparison view, advice panel, free-text input
- [x] `feat/ui-experience`: interactive route map, instant comparison, comparison chart
- [x] `feat/map-filters`: land outline, zoom and pan, collision-free labels, city pickers, URL state
- [x] `feat/auth`: accounts, session login, private trips, login/registration UI
- [x] `feat/visual-refresh`: fresh travel palette, Manrope headings, 17 px body, AA contrast in both themes
- [ ] `docs/readme-demo`: README, screenshots, demo recording

## Decisions log
| Date | Decision | Reason |
|---|---|---|
| 2026-11-10 | H2 in-memory + Flyway | Zero-setup run; schema still versioned like production |
| 2026-11-10 | Comparison computed, not stored | Always reflects current mode parameters; less state |
| 2026-11-10 | Open-Meteo for weather | Free, no key, keeps zero-config promise |
| 2026-11-11 | Root + module CLAUDE.md files | Module rules load only when relevant |
| 2026-11-11 | Spring Boot 4.1.2 + springdoc-openapi 3.2.0 | Latest stable Boot; springdoc 3.x is the line built for Boot 4 |
| 2026-11-11 | `GlobalExceptionHandler` extends `ResponseEntityExceptionHandler` | Spring MVC's own errors (malformed JSON, 405, 415, unknown path) also return Problem Details |
| 2026-11-11 | CORS origins via `routewise.cors.allowed-origins` (env `ROUTEWISE_CORS_ALLOWED_ORIGINS`) | Default works locally with zero config; deployable origins without code changes |
| 2026-11-11 | Trip responses embed `origin`/`destination` as `{id, name, country}`; requests send `originCityId`/`destinationCityId` | UI shows city names without extra lookups; writes stay id-based |
| 2026-11-11 | 25 seeded European cities; travelers 1–9 | Distances where every mode is plausible; typical group-booking limit |
| 2026-11-11 | Unknown city id or origin = destination → 400 with `errors` entry (`FieldValidationException`) | It is invalid input, not a missing resource; same shape as Bean Validation errors |
| 2026-11-11 | Transport mode cost/CO₂ are per traveler, except CAR (per vehicle) | Matches how fares vs. car costs work; comparison engine divides CAR by travelers |
| 2026-11-11 | Departure date must be today or later on create; on update a past date may be kept unchanged | Past trips stay editable (title, notes) without allowing new past dates |
| 2026-11-11 | H2 pinned to 2.3.232 | 2.4.240 breaks CHECK constraints created on another connection (Flyway); revisit on next H2 release |
| 2026-11-11 | API default port 8087 (`SERVER_PORT` overrides) | 8080 collides with common local services; zero-config start must just work |
| 2026-11-11 | Route distance = haversine × 1.2 (train), 1.3 (road: bus, car, bike), 1.0 (plane) | Simple, explainable detour factors; good enough without routing APIs |
| 2026-11-11 | Score 0–100: min-max normalised time/cost/CO₂ among available modes, weighted 0.6/0.2/0.2 by priority (BALANCED ⅓ each) | Relative ranking per trip; priority clearly dominates |
| 2026-11-11 | Car: 5 seats per car; cost and CO₂ per vehicle | 6–9 travelers need 2 cars |
| 2026-11-11 | Weather adjusts scores: bike ×0.4 for rain/snow/thunderstorm/wind ≥ 40 km/h/max < 3 °C; car and bus ×0.9 for snow/ice; worst of origin and destination counts | Weather-aware recommendation with a visible note per affected mode |
| 2026-11-11 | Weather is best-effort: outside today…+15 days, on errors or timeouts (2 s connect / 3 s read) the comparison is returned without weather | Zero-config and no hard dependency on an external service |
| 2026-11-11 | Added `spring-boot-starter-restclient` | Boot 4 moved `RestClient.Builder` auto-configuration into this module |
| 2026-11-11 | Claude via the official Anthropic Java SDK (`anthropic-java` 3.3.0), not hand-written `RestClient` calls | Typed structured outputs, built-in retries, stays current with the API; Jackson 2 it needs was already on the classpath (springdoc) |
| 2026-11-11 | Advisor LLM is opt-in: `AdvisorClient` bean exists only if `routewise.advisor.api-key` (env `ANTHROPIC_API_KEY`) has text; model `claude-opus-5-5`, effort `low`, 20 s timeout, 1 retry, all configurable | Zero-config run; low effort keeps short extraction/explanation calls fast |
| 2026-11-11 | Rules are not an `AdvisorClient` implementation: `AdvisorService` uses the LLM if present and falls back to `RuleBasedTripParser`/`RuleBasedAdviceWriter` on absence or any failure; responses carry `source` (`AI`/`RULES`) | Fallback is a service decision (like `WeatherService`); one injection point, no bean ambiguity |
| 2026-11-11 | LLM output is never trusted: extractions go through `TripDraftResolver` (seeded cities only, no past dates, travelers 1–9) and the recommended mode always comes from `ComparisonEngine` | The AI words the advice; it cannot change the recommendation or produce an invalid draft |
| 2026-11-11 | Parse drafts default to 1 traveler and BALANCED; unknown cities/dates are `null` with a `warnings` entry | The trip form always gets a usable draft and the user sees what is missing |
| 2026-11-11 | Claude requests opt into server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) | Recommended for Opus 5.5; a remaining refusal still falls back to rules |
| 2026-11-11 | No rate limit or cost guard on the advisor endpoints in v1; input capped at 1000 characters, LLM call bounded by timeout × (retries + 1) = 40 s | No auth in v1 scope; revisit before any public deployment with a key configured |
| 2026-11-11 | Angular 22 with CLI defaults: standalone, zoneless, signals, Vitest, esbuild; npm | Current recommended stack; no legacy patterns to migrate later |
| 2026-11-11 | No UI library: custom SCSS design tokens (CSS variables) with light/dark theme | No extra dependency; small bundle (about 80 kB transfer); Angular Material can still be added if forms get heavy |
| 2026-11-11 | UI calls the API directly at `http://localhost:8087` (`API_BASE_URL` token from `environment.ts`), no dev proxy | The API already allows the UI origin via CORS; one less moving part |
| 2026-11-11 | All HTTP failures become `ApiError` in one interceptor | Pages handle a single error type built from Problem Details, including field errors and "API unreachable" |
| 2026-11-11 | Added angular-eslint (Prettier ships with the scaffold); no root `npm run dev` script yet | Lint command and format hook were already documented; a combined start script needs another dependency (`concurrently`) and is undecided |
| 2026-11-11 | Trip form uses native controls: `<select>` for the 25 cities, `<input type="date">`, radio buttons for priority | Accessible without a UI library; a custom autocomplete is not worth it for 25 options |
| 2026-11-11 | Client-side form rules mirror the API (distinct cities, date today or later unless unchanged on edit, 1–9 travelers); API field errors are still shown on the matching field | Fast feedback, while the API stays the source of truth |
| 2026-11-11 | Delete needs an inline second confirmation (`ConfirmAction`), no modal dialog | Prevents accidental deletes; simpler and easier to test than a dialog |
| 2026-11-11 | Routes: `/trips`, `/trips/new`, `/trips/:id`, `/trips/:id/edit`; one form page serves create and edit | Bookmarkable pages; no duplicated form |
| 2026-11-11 | Recommendation and comparison live on the trip details page, each loaded separately after the trip | One place to decide; the trip shows immediately and a slow or failed advisor call does not block the comparison |
| 2026-11-11 | Comparison is one table (mode, time, cost, CO₂, score) with the recommended row marked by a badge and border; unavailable modes show their reason | Scannable side by side; nothing is conveyed by color alone |
| 2026-11-11 | Free-text input sits above the form on the New trip page and only prefills it; the user reviews, fixes warnings and saves | The advisor never creates a trip by itself; unknown values stay empty and are validated by the form |
| 2026-11-11 | Advice and drafts show their source ("AI advisor" / "Rule-based") | Users can tell AI wording from computed results |
| 2026-11-12 | `POST /api/comparisons` compares an unsaved route; same response as a trip's comparison with `tripId` null, same city and date rules as a trip | Lets the UI show a comparison while the user explores; one response shape for both cases |
| 2026-11-12 | Route map is hand-drawn SVG: cities placed with a Mercator projection of their coordinates on a dot grid, no base map, no map library | Distinctive, no dependency or external tiles; the 25 cities are enough to read as a map |
| 2026-11-12 | Map and chart are never the only way: dropdowns mirror the map in the form, the table mirrors the chart, selection is stated in text | Keyboard and screen-reader users get the same information |
| 2026-11-12 | Comparison chart shows one metric at a time; the recommended mode is the only accent bar, the others are gray | One series is the point: emphasis reads faster than five colors, and stays clear for color-blind users |
| 2026-11-12 | The takeaway line is computed from the comparison only (CO₂ and money saved against the highest-emitting alternative, or time gained) | A concrete fact, never an invented equivalence |
| 2026-11-12 | A new trip's title follows the chosen cities until the user types their own | Prefilled titles no longer go stale when a city is changed |
| 2026-11-12 | On narrow screens the interactive map keeps its size and scrolls sideways | City names stay readable instead of shrinking to about 7 px |
| 2026-11-12 | Map land and borders from Natural Earth 1:50m (public domain), clipped and simplified by a script into `europe-land.ts` (35 kB, lazy chunk) | Real geography without a map library or tile service; regenerate rather than hand-edit |
| 2026-11-12 | Map zoom/pan by changing the SVG viewBox (1×–6×); marks and text sized per CSS pixel so they stay readable at any zoom and screen width | Replaces the sideways-scrolling map on phones; one drawing for all sizes |
| 2026-11-12 | City labels placed by a collision check (no overlaps); a label that does not fit is hidden until zoomed in, the city stays a labelled button | Readable at every zoom without a hand-maintained placement table |
| 2026-11-12 | Explorer state (route, date, travelers, priority) lives in the URL; a new route adds a history entry, other changes replace it | Shareable links and a working Back button without extra history noise |
| 2026-11-12 | Results stay visible (dimmed) while a new comparison loads | Changing a setting no longer makes the page jump |
| 2026-11-12 | Accounts with Spring Security session login (HTTP-only `JSESSIONID`), not JWT; JSON endpoints under `/api/auth`, no form login | A same-site SPA needs no tokens in JavaScript; sessions can be ended server-side; least code |
| 2026-11-12 | Added `spring-boot-starter-security` (+ `-security-test`) | Password hashing, session handling and CSRF protection should not be hand-written |
| 2026-11-12 | Trips get `owner_id` (V4); another user's trip answers 404, not 403 | Ids reveal nothing about other users' trips |
| 2026-11-12 | Public: reference data, `POST /api/comparisons`, auth endpoints. Advisor parse needs a login | Explore without an account; the optional LLM call is no longer open to anonymous callers |
| 2026-11-12 | CSRF: SPA cookie pattern (`XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header) plus `CsrfCookieFilter` | Spring Security 7 creates the token lazily, so without the filter the cookie never reaches the browser and the first POST fails |
| 2026-11-12 | CORS allows credentials (origins stay explicit) | The UI on :4200 must send the session cookie to the API on :8087 |
| 2026-11-12 | UI reads `XSRF-TOKEN` from `document.cookie` in its own interceptor | Works because UI and API share the host (cookies ignore ports); a deployment on different hosts needs a reverse proxy under one host |
| 2026-11-12 | Login errors use one message for unknown email and wrong password; passwords 8–72 characters | No account enumeration; 72 is BCrypt's input limit |
| 2026-11-12 | After login the UI returns to `returnUrl` only if it is a path inside the app | Prevents open redirects through crafted login links |
| 2026-11-12 | Auth moved from out of scope into v1 scope | Saved trips need an owner before the app can be shared or deployed; without accounts every visitor sees and edits every trip |
| 2026-11-12 | Demo account seeded at start-up by `DemoDataSeeder` through the regular services (account + 3 trips 14/30/45 days ahead); `routewise.demo.*`, on by default, `ROUTEWISE_DEMO_ENABLED=false` turns it off | Reviewers can try the app in one click; relative dates never go stale; public credentials, so not a secret |
| 2026-11-12 | Taken email on register → 409 Conflict (`DuplicateFieldException`), still with an `errors` entry | Conflict is the correct status for a unique-value clash; the UI keeps showing it on the email field |
| 2026-11-12 | Session timeout 2 h of inactivity (`ROUTEWISE_SESSION_TIMEOUT`), cookie HTTP-only + SameSite=Lax; no signing secret because session ids are random server-side ids, not signed tokens | Explicit, configurable expiry instead of the container default; nothing secret to configure keeps the zero-config start |
| 2026-11-12 | Visual refresh: "fresh travel" palette (ocean-blue primary #1F5FD6, sunset highlight for the recommended mode, soft white background), dark theme retuned to match | Chosen by the human from three directions; brighter and friendlier than the gray/teal look, still calm enough for data |
| 2026-11-12 | Recommended mode uses the sunset highlight (row, badge, chart bar) instead of the primary blue | Blue now means "action or selection"; a separate color for "best option" reads at a glance, and the badge text and row border keep it clear without color |
| 2026-11-12 | Body text 17 px / 1.6, Manrope for headings, labels, buttons and navigation (Google Fonts, system font fallback) | Readability was the main complaint; a display font gives the brand a face without changing body text rendering |
| 2026-11-12 | Contrast checked with a script for every token pair (text 4.5:1, marks 3:1) in both themes; inputs get a 3:1 border | Verified, not eyeballed; the old input border was about 1.3:1 |
