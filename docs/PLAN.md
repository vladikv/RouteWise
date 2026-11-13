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
- Multi-stop trips: an ordered list of 2–10 stops; the comparison is computed per leg
  and recommends a mixed itinerary, compared with single-mode alternatives
- Glass UI: translucent surfaces on a layered background in the existing palette; the Home map
  fills wide screens with floating panels; the Trips page has KPIs, filters and a board/list view
  (before/after screenshots in `docs/screenshots/`)
- Light, dark and system theme (choice kept in the browser); Home offers a Map and a Split layout;
  trips can be duplicated and moved to another priority from the Trips page
- Interactive globe map and about 150 cities on every continent; ground modes only between
  cities joined by land, flights with separate short- and long-haul CO₂ factors

Out of scope for v1: social login, password reset, email verification,
real-time timetables, booking.

## Domain model

**AppUser**: account
`id, email (stored lower-case, unique), passwordHash (BCrypt), displayName, createdAt`

**City**: seeded reference data
`id, name, country, latitude, longitude, continent, landmass, capital, labelRank`
*(changed in `feat/globe-map`: `continent` (AFRICA, ASIA, EUROPE, NORTH_AMERICA, OCEANIA, SOUTH_AMERICA),
`landmass` (ground-connected region, e.g. EURASIA, AFRICA, NORTH_AMERICA, SOUTH_AMERICA, AUSTRALIA, JAPAN,
IRELAND, ICELAND, NEW_ZEALAND), `capital` (boolean), `labelRank` (1 = shown first … 3 = only when zoomed in))*

**TransportMode**: seeded reference data
`code (TRAIN|BUS|CAR|BIKE|PLANE), avgSpeedKmh, costPerKm, co2GramsPerKm, fixedOverheadMinutes, maxDistanceKm`

**Trip**: user-owned, full CRUD, visible only to its owner; aggregate root of its stops
`id, ownerId, title, departureDate, travelers, priority (FASTEST|CHEAPEST|GREENEST|BALANCED), notes, createdAt, updatedAt, stops`
*(changed in `feat/multi-stop-trips`: `originCityId`/`destinationCityId` replaced by `stops`)*

**TripStop**: part of a trip (cascade + orphan removal, ordered by `position`) *(new)*
`id, trip (ManyToOne), city (ManyToOne), position (0-based)`.
2–10 stops; no two consecutive stops in the same city (a round trip, first = last, is allowed).
A simple A → B trip is a trip with 2 stops.

**Comparison**: computed, not stored *(changed: per leg)*
A leg is stop *i* → stop *i+1*. Per leg and mode: `durationMinutes, totalCost, co2Kg, score, recommended`,
with the leg's weather. Per trip: `recommendedItinerary` (sum of each leg's recommended mode)
and `singleModeTotals` (one mode for every leg, only if that mode is available on every leg).
Distance = haversine between cities × road/rail factor. All legs use the trip's departure date.
*(changed in `feat/globe-map`)* Ground modes (TRAIN, BUS, CAR, BIKE) are available only when both cities share a
`landmass` and the leg is within the mode's `maxDistanceKm`; otherwise the option is unavailable with
`unavailableCode` `DIFFERENT_LANDMASS` or `TOO_FAR` (plus the readable `unavailableReason`). PLANE uses a
short-haul CO₂ factor up to the DEFRA long-haul threshold and a long-haul factor above it.

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
| GET | `/api/trips` | List your trips *(changed: `stops` instead of `origin`/`destination`)* |
| GET | `/api/trips/{id}` | Trip details *(changed: `stops: [{cityId, cityName, position}]`)* |
| POST | `/api/trips` | Create trip (201 + Location) *(changed: request `stops: [{cityId}]`)* |
| PUT | `/api/trips/{id}` | Update trip; replaces the whole ordered stop list *(changed)* |
| DELETE | `/api/trips/{id}` | Delete trip (204) |
| GET | `/api/trips/{id}/comparison` | Per-leg comparison: `legs[]` (from, to, distanceKm, options[], recommendedMode), `recommendedItinerary`, `singleModeTotals[]` *(changed)* |
| POST | `/api/comparisons` | Compare stops without saving a trip; request `stops: [{cityId}]`, same response, `tripId` null *(changed)* |
| GET | `/api/trips/{id}/advice` | AI/rule-based advice incl. weather; explains the itinerary leg by leg *(changed)* |
| POST | `/api/advisor/parse` | Free text → trip draft with ordered `stops` *(changed)* |
| GET | `/api/cities` | Cities for autocomplete *(changed, additive: `continent`, `landmass`, `capital`, `labelRank`)* |
| GET | `/api/transport-modes` | Mode parameters |

`feat/globe-map` adds fields only (cities as above; `unavailableCode` on comparison options and
single-mode totals); no field is removed or renamed.

Breaking change in `feat/multi-stop-trips`: trip, comparison and draft payloads replace
`origin`/`destination` (`originCityId`/`destinationCityId`) with `stops`; the UI changes in the same milestone.

`feat/ui-glass-redesign` changes no endpoint or DTO; the Trips page reads its figures from the existing
`GET /api/trips/{id}/comparison`.

## External services
- **Open-Meteo**: weather forecast, no API key required
- **LLM provider**: optional Claude (Anthropic) via `ANTHROPIC_API_KEY`; behind an
  `AdvisorClient` interface, with rule-based parsing/advice as fallback
- **Natural Earth** (public domain): world land and borders at 1:110m for the globe (`feat/globe-map`)

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
- [x] `feat/visual-refresh`: midnight/white/lime 60/30/10 dark theme, Manrope headings, 17 px body, split-screen login, AA contrast
- [x] `feat/multi-stop-trips`: trips with 2–10 ordered stops, per-leg comparison with a mixed itinerary vs single-mode totals, multi-stop parsing and advice, stops editor and leg timeline in the UI
  - Backend: `TripStop` + V5 migration converting each existing trip into 2 stops and dropping the origin/destination columns (no old migration edited); validation 2–10 stops, existing cities, no consecutive duplicates → 400 with field errors (`stops[i].cityId`); ownership unchanged
  - Comparison: per-leg scoring stays in pure functions (`ComparisonEngine` per leg + a pure itinerary/totals calculator); weather per leg (worst of its two cities)
  - Advisor: parse returns ordered stops (LLM schema and rule-based parser), unknown cities → null stop + warning, only the first date is kept (warning for later dates); advice explains the itinerary leg by leg, also in the rule-based writer
  - Demo data: the seeder's trips use stops; at least one has 3+ stops
  - Frontend: trip form with a stops list (add, remove, move up/down, city picker, inline validation); trip list and details show the stops; comparison as a leg timeline with the recommended mode per leg and totals vs single-mode alternatives; maps draw every leg; the home explorer stays A → B (2 stops)
  - Done when: tests for the migration (existing rows converted), validation cases, per-leg calculation, totals, ownership, parse with stops, rule-based fallback, UI specs; `./mvnw verify` and `npm test` green; README "Data & assumptions" updated if it exists by then; `docs/AI_WORKFLOW.md` entry
- [ ] `feat/ui-glass-redesign`: glassmorphism redesign of the Angular UI: map-first Home on wide screens with floating panels, Trips page with KPIs, filters and board/list view, bottom sheet on phones; visual and layout only
  - Tokens first: the palette stays as defined in `frontend/src/styles.scss` `:root` (bg `#0b0d12`, surface `#141820`, text white / `#b8bfcc`, lime `#b6f23c`, amber `#f5b871`, danger `#ff8a80`, map colours); new tokens only for alpha variants of these, glass surfaces, borders, blur, radii (16–24 px, pill) and spacing; the hard-coded colours in `shared/map/route-map.scss` and `shared/ui/city-picker.scss` move to tokens; no hard-coded colours in components
  - Building blocks in `shared/ui`: glass panel, pill nav, stat chip, tabs / segmented toggle, filter chip, icon button, bottom sheet
  - Shell: fixed layered background with soft blurred lime glows; header with the logo on a lime tile, centred pill nav (Home, Trips) with a lighter active item, round icon buttons and Log in / avatar; the nav collapses into a menu below 768 px
  - Home ≥ 1280 px: the map fills the viewport below the header (route, pins and labels unchanged); left glass panel: hero, From/To with swap, priority, "Describe a trip instead"; right glass panel: savings banner, Score/Time/Cost/CO₂ tabs, mode bars with the Recommended badge, weather card for origin and destination from `ComparisonResponse.weather`; both panels collapse (keyboard operable); map zoom controls are never covered; panel text ≤ ~70 characters per line
  - Home 768–1279 px: stacked map → form → results; < 768 px: map on top, form and results in a bottom sheet that can be dragged up or toggled by keyboard
  - Trips: large title + KPI stat chips (trips planned, CO₂ saved vs car, average cost per trip); toolbar with search, filter chips (priority, recommended mode), Board/List toggle and a lime "New trip" button; glass cards with date, route title, stops line, cost or CO₂ and a "⋯" menu with the existing actions; Board groups by priority (column header: count and total cost), List is a compact table-like list
  - Trip figures come from `GET /api/trips/{id}/comparison`, one request per trip; cards and KPIs show a loading state, a failed comparison leaves that trip out of the KPIs with a visible note; KPI maths in pure, unit-tested functions
  - Accessibility and performance: AA contrast on glass (the contrast check composites translucent surfaces over the background), visible focus rings, `prefers-reduced-transparency` → solid surfaces, `prefers-reduced-motion` respected; few stacked `backdrop-filter` layers, no blur per list card, map panning stays smooth; loading, empty and error states restyled
  - Unchanged: routes, API calls, behaviour, URL state, the hand-drawn SVG map, no new dependency
  - Round 1 done when: `npm run lint` and `npm test` green, with specs for the new building blocks, panel collapse, bottom sheet, trips KPIs, filters and grouping; before/after screenshots at 1920, 1280 and 375 px in `docs/screenshots/`; `docs/AI_WORKFLOW.md` entry
  - **Round 2** (same branch, human review of round 1: surfaces still look solid, toolbar cramped, Map layout flaws in `small_screen.png`/`big_screen.png`):
    - Real glass: fixed background layer with 2–3 large soft glows from lime and its alpha variants, slowly animated (static under reduced motion); glass tokens = white 5–8% fill, 16–24 px blur with saturation boost, 1 px white 10–14% border, inner top highlight; applied to top bar, panels, cards, chips, inputs and menus; check that no opaque parent or stacking context blocks `backdrop-filter`; reduced transparency → solid
    - Top bar: strict 3-column grid (logo | nav | actions), nav pill centred on the viewport on every page; theme button next to Log in / avatar; menu below 768 px
    - Theme: Light / Dark / System via a round icon button with a small menu; default System; choice in `localStorage` (try/catch, fallback System); `data-theme` on `<html>` set by an inline script in `index.html` before first paint (no flash); light theme from the same palette with its own glass and map tokens; AA in both themes, also on glass
    - Trips toolbar: row 1 search (flexible), Board/List, New trip right; row 2 two labelled groups "Priority" and "Mode" that wrap as a whole, counts as small muted badges; active chips highlighted, "Clear filters" and a result count ("3 of 5 trips"); < 768 px a "Filters" button opens a bottom sheet
    - Cards and rows: whole card/row opens the trip details (keyboard, focus ring); hover/focus lift with a glow border in the card's tint and quick actions (open, edit, duplicate, delete), the same actions in the "⋯" menu; mini route line with a dot per stop and a mode icon per leg, countdown badge, small CO₂ bar vs car; delete keeps its confirmation
    - Duplicate opens the New trip form prefilled with the trip (all stops; departure date kept unless it is in the past, then empty) through router navigation state; the user saves it — nothing is created without the form
    - Board: drag a card (pointer events, hand-written) to another priority column → `PUT /api/trips/{id}` with the trip's existing fields and the new priority; optimistic update, rollback and an error toast on failure; also "Move to …" in the "⋯" menu for keyboard and touch
    - List: sortable date, cost and CO₂ columns (`aria-sort`), row hover state
    - Home layouts: "Map" (floating panels over the full map) and "Split" (map about 58 % wide, sticky full height on the left; form and results scroll independently on the right; stacked below 1024 px; results in a bottom sheet on phones); segmented icon toggle in a Home toolbar with labels; default Split, choice in `localStorage` (try/catch); Map only offered from 1440 px, below that Split is shown without overwriting the saved choice; switching keeps all state (cities, priority, results, map view) without refetching; form and results are the same components in both layouts
    - Map layout fixes: map covers the whole area under the top bar with no edges; route fit padded by the panel widths; empty results panel collapses into a hint chip until results arrive; left panel fits 1440×900 without an inner scrollbar (one-line intro, 2×2 priorities, tighter spacing); no horizontal scrollbars inside panels (the "Exact numbers" table wraps or stacks); zoom controls bottom-right, clear of both panels
    - New building blocks: filter group, menu, toast; loading, empty and error states in both themes
    - Done when: `npm run lint` and `npm test` green, with specs for the theme service (saved choice, System, storage failure), layout selection (breakpoint, saved preference, storage failure, state kept when switching), filter logic and result count, list sorting, priority change by drag and by menu incl. rollback, duplicate prefill; screenshots in `docs/screenshots/` replacing the round-1 `after-*` set: both themes × Home Split, Trips Board and Trips List at 1920/1280/375 px, plus Home Map at 1920 px in both themes; `docs/AI_WORKFLOW.md` entry
- [x] `feat/globe-map`: interactive globe map, about 150 worldwide cities, landmass-based mode availability and split flight CO₂ factors
  - Depends on `feat/ui-glass-redesign` (Map/Split layouts, themes); start only after it is merged
  - Globe: `RouteMap` becomes an orthographic globe with `d3-geo` (only new dependency): drag to rotate, scroll/pinch and +/− to zoom, "Reset view", animated rotation to the selected route (instant under reduced motion); initial view on the selected cities, otherwise Europe; routes as great-circle arcs, markers as now, far-side cities, labels and arc parts hidden; land and borders follow the theme; works in Map and Split layouts and on the trip form and details maps; smooth while rotating (re-projection per animation frame, no layout work)
  - Labels never overlap (existing collision layout): `labelRank` 1 (capitals and major hubs) first, ranks 2–3 appear as the zoom grows; a hidden city stays a labelled button
  - World land: Natural Earth 1:110m land and borders, simplified by an extended generator script (replaces `europe-land.ts`), lazy chunk; size reported in the PR
  - Cities: new Flyway migrations: V6 adds `continent`, `landmass`, `capital`, `label_rank` to `city`, V7 fills them for the 25 existing cities and seeds 125 more (capitals and major transport hubs on all continents, city-centre coordinates), V8 sets the PLANE factors; no existing migration edited; city picker and autocomplete use the full list
  - Comparison (pure functions, backend): landmass and distance availability per leg with reason codes; PLANE short-/long-haul CO₂ factors from the DEFRA greenhouse gas conversion factors (year and threshold recorded in the README and the migration); PLANE `max_distance_km` raised so every city pair has at least one mode; multi-stop itinerary and single-mode totals use available modes only (as today)
  - Advisor: the rule-based parser matches multi-word and accented city names ("New York", "São Paulo", "Sao Paulo"); the LLM resolver keeps accepting seeded cities only
  - UI: unavailable modes greyed out with a readable reason from the code ("Not available: different continent or island", "Not available: too far for this mode")
  - README "Data & assumptions" (new section): prices are global estimates, landmass rule with its fixed links, flight factor split and source
  - Done when: tests for the migration (city count, coordinates within range, every city has a continent and landmass, existing 25 keep their ids), availability rules incl. edge cases (same landmass but too far, different landmass but short, exactly at the limit, Great Britain and Denmark via fixed links), short/long-haul factor at the threshold, per-leg itinerary with an intercontinental leg, parser with multi-word/accented names, far-side visibility, label priority by zoom, globe drag/zoom/reset and arc rendering; `./mvnw verify`, `npm run lint` and `npm test` green; `docs/AI_WORKFLOW.md` entry
- [ ] `docs/readme-demo`: README and demo recording

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
| 2026-11-12 | Replaced the "fresh travel" palette with a strict 60/30/10: midnight black backgrounds (#0B0D12, cards #141820), pure white text and lines, lime #B6F23C as the only accent | Brief from the human after seeing the first palette; one accent keeps the eye on actions and the best option |
| 2026-11-12 | Dark theme only; the light/dark toggle and `ThemeService` were removed | The identity is black/white/lime; a light variant could only use lime as a fill (lime text on white is about 1.3:1) |
| 2026-11-12 | The recommended mode, primary actions, links, selection, focus and the map route all use the same lime; every other mark is gray (`--color-bar`) | Supersedes the sunset highlight: with one accent, "lime" means "act here" or "best option"; badge text and row border keep it clear without colour |
| 2026-11-12 | Login and registration are a split screen on wide screens (pitch with benefits and the demo account on the left, form card on the right), stacked with the form first on phones | The old narrow left column looked unbalanced; the form stays first in DOM order for keyboard and screen-reader users |
| 2026-11-12 | Home page: the map spans the full width on top; below it the settings (route, priority, date, travelers) sit on the left and the results on the right (sticky), stacked on narrow screens | Requested by the human; the map is the main way in, and results next to the settings show the effect of each change at once |
| 2026-11-12 | The wide map widens its view to the land outline (lon -18..30, about 1.5:1) instead of stretching or cropping the square map | Same projection and labels, no empty bands or cut-off coasts, and the map does not grow taller than the screen |
| 2026-11-12 | Land outline regenerated for longitude -30..48 (was -18..30; 56 kB, lazy map chunk) with `frontend/scripts/gen-europe-land.py`, and the wide home map shows only the band the cities occupy | The full-width map dropped from about 830 to about 465 px tall on a laptop with every city still visible; the generator is now in the repo so the data can really be regenerated |
| 2026-11-12 | Multi-stop trips: `Trip` owns an ordered list of 2–10 `TripStop`s; a simple trip is 2 stops; stops are part of the trip resource, not a separate endpoint | Real journeys have several legs; keeping stops inside the trip aggregate means one request saves a consistent route |
| 2026-11-12 | Comparison is computed per leg; the recommended itinerary sums each leg's best mode, compared with `singleModeTotals` (a mode only if allowed on every leg) | Shows when mixing modes beats sticking to one; per-leg scoring reuses the existing pure engine |
| 2026-11-12 | `POST /api/comparisons` also takes `stops` and returns the same legs-based response; the home explorer sends 2 stops | One comparison contract for saved and unsaved routes |
| 2026-11-12 | City list stays at the 25 seeded cities; unknown cities in free text give a null stop and a warning | No new reference data or map density; same handling as unknown cities today |
| 2026-11-12 | Stops have no dates: every leg uses the trip's departure date for weather; the parser keeps the first date and warns about later ones | Matches the current model; per-stop dates can be a later milestone |
| 2026-11-12 | V5 adds `trip_stop` (column `stop_position`, unique per trip, ON DELETE CASCADE), copies every trip's origin and destination into positions 0 and 1, then drops the old columns; tested by migrating a V4 database with data | No existing migration edited; existing trips keep their route |
| 2026-11-12 | `Trip.replaceStops` reuses stop rows position by position instead of clearing the list | Hibernate inserts before it deletes, so clear-and-add would break the unique (trip, position) constraint |
| 2026-11-12 | One `StopResolver` validates stop lists for trips and `POST /api/comparisons`; every bad stop is reported (`stops[i].cityId`: unknown city, or same as the stop before) | Same rules and error shape for both endpoints; the form shows each error on its stop |
| 2026-11-12 | Per-leg weather: forecasts are fetched once per distinct stop city; each leg uses the worst of its two cities | One weather call per route; a round trip does not ask twice for its first city |
| 2026-11-12 | Advice returns `recommendedModes` (one per leg) and `legs` (one sentence per leg) instead of `recommendedMode`; a Claude answer with the wrong number of leg sentences falls back to rules | The recommendation stays computed per leg; the LLM only words it |
| 2026-11-12 | The rule-based parser keeps capitalised names of unsupported places after route words ("to Zakopane") so the resolver can name them; a date after "back home"/"return" is a later date, not the departure | Users see which stop could not be matched instead of a silently shorter route |
| 2026-11-12 | Trip form: a stop list of `CityPicker`s (search, keyboard, add/remove/move) replaces the two native `<select>`s; a city clicked on the map fills the next empty stop | Requested autocomplete; the 2026-11-11 "native selects" decision no longer fits a variable-length list |
| 2026-11-12 | Two-stop trips and the home explorer keep the single-leg chart and table (via `legComparison`); multi-stop trips get a leg timeline, a whole-trip table (mixed plan vs each mode throughout, duplicates of the plan hidden) and each leg's details | Nothing changes for simple trips; the extra view only appears when it carries information |
| 2026-11-12 | The demo's multi-stop sample is a FASTEST loop Berlin → Prague → Vienna → Munich → Berlin (train, train, plane, plane) | With BALANCED or GREENEST the scoring picks the bus on nearly every leg, so a BALANCED demo never showed a mixed plan |
| 2026-11-12 | Glass redesign keeps the midnight/white/lime palette: glass surfaces are alpha variants of the existing tokens over a layered background with lime glows; no new hues | The requested look without giving up the 60/30/10 identity or the AA contrast checks |
| 2026-11-12 | On screens ≥ 1280 px the Home map becomes the page background with two collapsible floating panels; 768–1279 px stacks map, form and results; phones use a bottom sheet | Supersedes the "map on top, settings left, results right" Home layout: the map is the main way in and now uses the whole screen |
| 2026-11-12 | Trips page figures (KPIs, card value, tint, mode filter) come from one `GET /api/trips/{id}/comparison` per trip, not from new fields on `GET /api/trips` | Keeps the milestone visual only with no API change; fine for a handful of trips, revisit with a list summary if trip counts grow |
| 2026-11-12 | Trip card tint from existing colours at low opacity: lime for TRAIN and BIKE, amber for PLANE, neutral for CAR and BUS; a mixed itinerary stays neutral; the mode is also named on the card | Five distinct mode hues would break "no new hues"; the tint is a hint, never the only signal |
| 2026-11-12 | Manrope becomes the only font (body included, weight 400 added to the existing Google Fonts request) | "One geometric sans" without a new dependency; the font is already loaded |
| 2026-11-12 | Bottom sheet, collapsible panels and segmented toggle are hand-written components (pointer events + keyboard), no Angular CDK | Small, testable pieces; no new dependency for three interactions |
| 2026-11-12 | Pill nav matches Home by path only, ignoring query parameters | The explorer keeps its state in the query string, so an exact match never marked Home as the current page |
| 2026-11-12 | In fill mode the map uses a "cover" view sized to its container, centred on the cities between the panels (`insetStart`/`insetEnd`), with land fading into the sea colour where the data ends | Letterboxing left hard edges and empty bands; cropping to the container keeps every city visible without stretching |
| 2026-11-12 | The route uses a non-scaling stroke with no dash pattern; the draw-in animation grows a pixel dash from 0 to longer than any route | Dash lengths of a non-scaling stroke are screen pixels, so the old 1-unit pattern broke the line into dashes at the new map scales |
| 2026-11-12 | Trips page is 84rem wide (other pages 68rem); the header spans the full width with the Home panels' 24 px gutter | Four board columns need the room; a full-width header lines up with the floating Home panels |
| 2026-11-12 | Board view by default from 1280 px, list below; trip cards and table rows have no backdrop blur | Four columns do not fit narrower screens; blur on every card is the main cost on long lists |
| 2026-11-12 | Known limit: when the map zooms to a route it centres on the whole map, so at 1280 px a long route can sit partly under a panel | Panning, zoom or collapsing a panel fixes it; margin-aware route fitting is left for later |
| 2026-11-12 | Light, dark and system themes return (`data-theme` on `<html>`, set before first paint; default System) | Requested by the human in round 2; supersedes "Dark theme only". In light mode lime is a fill only (buttons, badges, selection backgrounds with dark text) and the map route keeps a dark halo, because lime text or thin lime lines on white are about 1.3:1 |
| 2026-11-12 | Glass = white 5–8 % fill with blur and saturation over an animated glow layer, replacing the "surface alpha ≥ 60 %" rule | Round 1 looked solid because the fill was nearly opaque over a near-uniform background; contrast is re-checked over the brightest glow position in both themes |
| 2026-11-12 | Home has two layouts, Map and Split; Split is the default and the only one below 1440 px | Supersedes "map is the page background from 1280 px": the floating panels were too cramped below 1440 px, and Split keeps form and results readable |
| 2026-11-12 | Trip priority can be changed from the board (drag or menu) through the existing `PUT /api/trips/{id}`, optimistic with rollback | Quick re-sorting without opening the form; no API change because the list already carries every field the PUT needs |
| 2026-11-12 | Duplicate prefills the New trip form (all stops) via navigation state instead of creating a copy | Keeps the rule that a trip is only created from the form the user reviewed; a past date would be rejected anyway |
| 2026-11-12 | Drag and drop, menus, toasts and the filter sheet are hand-written (pointer events + keyboard), no Angular CDK | No new dependency; every drag action also has a menu equivalent for keyboard and touch |
| 2026-11-13 | Globe with `d3-geo` (orthographic projection, horizon clipping, great-circle interpolation); drag, zoom and labels stay hand-written, no 3D library | Clipping land outlines at the visible horizon is the error-prone part of a globe; a small, tree-shaken, well-tested library beats hand-written clipping, and WebGL would replace the accessible SVG map. Supersedes the "hand-drawn SVG, no map library" and Mercator/viewBox map decisions |
| 2026-11-13 | `landmass` means a ground-connected region: fixed links count (Channel Tunnel, Øresund and Great Belt bridges, so Great Britain and the Danish islands are part of Eurasia), ferries do not (Ireland, Iceland, Japan, Australia, New Zealand are separate); Africa is separate from Eurasia | Matches how people actually travel by ground and keeps today's European results (London by train) unchanged; the only Africa–Asia land link is far from typical routes |
| 2026-11-13 | Unavailable options get a machine-readable `unavailableCode` next to the existing text | The UI can word and style each reason (greyed out, "different continent or island") without parsing English text; additive, no breaking change |
| 2026-11-13 | Cities carry `capital` and a hand-assigned `labelRank` (1–3) for label priority | "Capitals first, more as you zoom in" needs an order; a rank is simpler and more stable than population data |
| 2026-11-13 | About 150 cities replace the "City list stays at the 25 seeded cities" rule | Worldwide routes need cities on every continent; existing city ids stay so saved trips keep their stops |
| 2026-11-13 | One `RouteMap` globe everywhere (Home, trip form, trip details) | One map component to test and theme; small maps start on the route instead of Europe |
| 2026-11-13 | Flight CO₂ factors: DEFRA 2023, economy class with radiative forcing: 183 g/pkm short-haul, 200 g/pkm above 3,700 km great-circle distance (threshold exclusive); set in their own migration (V8) | Economy matches the cost model's typical traveller; keeping the factors out of the city seed (V7) keeps one concern per migration. To verify against the official DESNZ spreadsheet before release |
| 2026-11-13 | City coordinates are hand-entered city centres, not taken from Natural Earth | About 150 well-known points need no data pipeline; Natural Earth stays the source of land and borders only |
| 2026-11-13 | `landmass` precedence: a ground mode between landmasses is `DIFFERENT_LANDMASS` even when it is also too far | The landmass is the reason the user can change (pick another mode), distance is secondary |
| 2026-11-13 | Maps inside a scrolling page (trip form, stacked Home Split) use cooperative gestures: Ctrl + scroll to zoom, vertical swipes scroll the page | A full-width globe must not trap page scroll; the Map layout and side-by-side Split keep direct wheel zoom |
| 2026-11-13 | Crowded low-rank cities are not drawn at the current zoom (they stay in the city picker); hit areas shrink to half the gap to the nearest city | With 150 cities, Europe at zoom 1 had neighbours taking each other's clicks and rank-1 labels pushed out |
| 2026-11-13 | `--map-border` raised to 3:1 against sea and land in both themes instead of a separate merged coastline | A merged outline needs polygon union, which the generator cannot do reliably without a new dependency |
| 2026-11-13 | No screenshots: milestones no longer require or produce screenshots; the UI reviewer works from code and tokens | Human decision; `docs/` is ignored by git, so new screenshots would not be kept anyway |
