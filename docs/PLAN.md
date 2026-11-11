# RouteWise — Development Plan

Living document. Claude reads it before starting work and updates
checkboxes when a milestone is completed.

## Scope (v1)
- Create, view, edit and delete saved trips
- Compare transport modes for a trip by time, cost and CO₂
- Weather-aware recommendation for the departure date
- AI travel advisor: free-text trip request → trip draft + explanation
- Works with zero configuration (rule-based fallback without an AI key)

Out of scope for v1: authentication, real-time timetables, booking.

## Domain model

**City**: seeded reference data
`id, name, country, latitude, longitude`

**TransportMode**: seeded reference data
`code (TRAIN|BUS|CAR|BIKE|PLANE), avgSpeedKmh, costPerKm, co2GramsPerKm, fixedOverheadMinutes, maxDistanceKm`

**Trip**: user-owned, full CRUD
`id, title, originCityId, destinationCityId, departureDate, travelers, priority (FASTEST|CHEAPEST|GREENEST|BALANCED), notes, createdAt, updatedAt`

**Comparison**: computed, not stored
Per mode: `durationMinutes, totalCost, co2Kg, score, recommended`.
Distance = haversine between cities × road/rail factor.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/trips` | List trips |
| GET | `/api/trips/{id}` | Trip details |
| POST | `/api/trips` | Create trip (201 + Location) |
| PUT | `/api/trips/{id}` | Update trip |
| DELETE | `/api/trips/{id}` | Delete trip (204) |
| GET | `/api/trips/{id}/comparison` | Mode comparison + recommendation |
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
- [ ] `feat/frontend-comparison`: comparison view, advice panel, free-text input
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
