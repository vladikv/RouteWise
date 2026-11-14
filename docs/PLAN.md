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
- Light, dark and system theme (choice kept in the browser) *(dark only from `feat/ui-reference-style`)*; Home offers a Map and a Split layout;
  trips can be duplicated and moved to another priority from the Trips page
- Interactive globe map and about 150 cities on every continent; ground modes only between
  cities joined by land, flights with separate short- and long-haul CO₂ factors
- The backend owns the trip figures: server-side search, filters, sorting, pagination and facet counts
  for the trip list, a stats endpoint for the KPIs, grouped messages for unavailable modes
- Delete with undo: deleted trips can be restored for a short window (default 30 s)
- Resilient external calls: cached weather with retry and an explicit "weather unavailable" status;
  `/actuator/health`
- Reference-style UI: one dark theme with a smoky multi-tone background and strong glass, the app in a
  rounded glass shell with a top bar and a left icon rail; Trips board lanes with tinted cards; an
  interactive list (inline details, pagination, keyboard); a Modes page; an account popover; delete
  through a confirm dialog with Undo
- Trip details page: route at a glance, key figures first, an interactive globe linked to the legs

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
*(changed in `feat/backend-depth`: Moscow removed, 149 cities)*

**TransportMode**: seeded reference data
`code (TRAIN|BUS|CAR|BIKE|PLANE), avgSpeedKmh, costPerKm, co2GramsPerKm, fixedOverheadMinutes, maxDistanceKm`

**Trip**: user-owned, full CRUD, visible only to its owner; aggregate root of its stops
`id, ownerId, title, departureDate, travelers, priority (FASTEST|CHEAPEST|GREENEST|BALANCED), notes, createdAt, updatedAt, stops`
*(changed in `feat/multi-stop-trips`: `originCityId`/`destinationCityId` replaced by `stops`)*
*(changed in `feat/backend-depth`: `deletedAt` (null = active; set by DELETE, cleared by restore; deleted trips
are left out of every query, stat and comparison); `createdAt`/`updatedAt` filled by Spring Data JPA auditing
from the injected `Clock`)*

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
*(changed in `feat/backend-depth`)* Unavailable modes are also grouped by code: each leg has
`unavailableGroups: [{code, modes[], message}]`, e.g. "Not reachable by land between Dublin and Madrid: train, bus,
car, bike", and the comparison has the same list for the single-mode totals ("Not possible for the whole trip:
train, bus, car, bike (no land route between Dublin and Madrid)"). `weatherStatus` says whether the weather is
`AVAILABLE`, `PARTIAL`, `UNAVAILABLE` (provider error or timeout) or `OUT_OF_RANGE` (date outside the forecast window).

**TripFigures**: computed, not stored *(new in `feat/backend-depth`)*
Per trip, from the same pure engine and itinerary calculator as the comparison but **without weather**:
`totalCost, co2Kg, carCo2Kg (null when the car cannot do the whole trip), co2VsCarPercent, co2ShareOfCar (0–1),
modes (distinct, leg order), legModes`; `null` when a leg has no available mode. Used by the trip list and the stats.

**TripStats**: computed per user over active trips *(new)*
`tripsPlanned, co2SavedVsCarKg (Σ max(0, car − plan) over trips with a car figure), co2TripsCounted,
tripsLeftOut, averageCost (over trips with figures; null if none), currency, nextTrip ({id, title, departureDate}
of the earliest trip departing today or later; null if none)`

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
| GET | `/api/trips` | Search your trips *(**breaking** in `feat/backend-depth`: was an array; now a page)*. Query: `q`, `priority` (repeatable), `mode` (repeatable), `from`, `to` (departure date, inclusive), `sort` (`date`\|`cost`\|`co2`, default `date`), `direction` (`asc`\|`desc`, default `asc`), `page` (≥ 0, default 0), `size` (1–100, default 20). Response: `items[]` (trip + `figures`), `page`, `size`, `totalItems`, `totalPages`, `currency`, `facets` (`priorities[{priority, count}]`, `modes[{mode, count}]`), `priorityTotals[{priority, count, totalCost}]`; 400 for bad parameters or `from` after `to` |
| GET | `/api/trips/stats` | KPIs over your active trips (`TripStats`) *(new)* |
| GET | `/api/trips/{id}` | Trip details *(changed: `stops: [{cityId, cityName, position}]`)* |
| POST | `/api/trips` | Create trip (201 + Location) *(changed: request `stops: [{cityId}]`)* |
| PUT | `/api/trips/{id}` | Update trip; replaces the whole ordered stop list *(changed)* |
| DELETE | `/api/trips/{id}` | Delete trip (204) *(changed: soft delete; status and body unchanged; a deleted trip answers 404 everywhere)* |
| POST | `/api/trips/{id}/restore` | Undo a delete within the restore window: 200 + trip; 200 if not deleted (idempotent); 409 Problem Details after the window; 404 for unknown or another user's trip *(new)* |
| GET | `/api/trips/{id}/comparison` | Per-leg comparison: `legs[]` (from, to, distanceKm, options[], recommendedMode), `recommendedItinerary`, `singleModeTotals[]` *(changed)* |
| POST | `/api/comparisons` | Compare stops without saving a trip; request `stops: [{cityId}]`, same response, `tripId` null *(changed)* |
| GET | `/api/trips/{id}/advice` | AI/rule-based advice incl. weather; explains the itinerary leg by leg *(changed)* |
| POST | `/api/advisor/parse` | Free text → trip draft with ordered `stops` *(changed)* |
| GET | `/api/cities` | Cities for autocomplete *(changed, additive: `continent`, `landmass`, `capital`, `labelRank`)* |
| GET | `/api/transport-modes` | Mode parameters |
| GET | `/actuator/health` | Health check, public, no details *(new)* |

`feat/ui-reference-style` changes no endpoint or DTO; it uses the endpoints above (incl. `page`/`size`
of `GET /api/trips` for the list's pagination and `GET /api/trips/{id}/comparison` when a list row is
expanded). An optional Preferences endpoint is only added if approved in its own step (see the milestone).

Changes in `feat/backend-depth`:
- **Breaking:** `GET /api/trips` returns a page object instead of an array (above); the UI changes in the same milestone.
- Additive: `GET /api/trips/{id}/comparison` and `POST /api/comparisons` get `weatherStatus`, `unavailableGroups`
  (top level and per leg); no field removed or renamed.
- `DELETE /api/trips/{id}` keeps 204, but the row is kept with `deletedAt`; a second DELETE answers 404.
- `GET /api/cities` no longer lists Moscow.

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
- [x] `feat/ui-glass-redesign`: glassmorphism redesign of the Angular UI: map-first Home on wide screens with floating panels, Trips page with KPIs, filters and board/list view, bottom sheet on phones; visual and layout only
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
- [x] `feat/backend-depth`: the backend owns the business logic (trip search, figures, facets, stats, grouped unavailable messages), soft delete with undo, resilient weather calls, auditing and architecture tests; the UI only displays
  - Depends on `feat/globe-map`. No visual changes (those come in a later UI milestone)
  - Moves from frontend to backend (the frontend files lose these functions and their specs move to backend tests):
    - `features/trips/list/trip-figures.ts`: `tripFigures`, `tripKpis`, `filterTrips`, `matchesSearch`, `groupByPriority` totals, `co2ShareOfCar`, `co2VsCarPercent` → `TripFiguresCalculator` (pure), `TripQueryService`, `TripStatsService`; `figuresOf`, `tintFor`, `modeSummary` stay (presentation of API values)
    - `features/trips/list/trip-filters.ts`: `priorityCounts`, `modeCounts`, `sortTrips` → facets and sorting in `TripQueryService`; `toggleSort`, `resultSummary`, `activeChipCount`, `hasActiveFilters` stay (UI state and wording)
    - `shared/util/labels.ts`: `unavailableDetail`, `unavailableText`, `unavailableTotalsText` and the `LEG_PREFIX` parsing of English reasons → `UnavailableGrouper` (pure) in `comparison/service`; the UI shows `unavailableGroups[].message` once per leg and once for the totals, and each unavailable row says only "Not available" (still muted with ⊘). This is the one wording change in the UI, requested with the grouping
    - The Trips page's one `GET /api/trips/{id}/comparison` per trip is removed: figures come with the list
    - Stays in the UI (out of scope): `comparisonInsight` (takeaway sentence on one leg of an already loaded comparison) and `legComparison` (reshaping)
  - Trip search (`trip/service/TripQueryService`, `trip/repository/TripSpecifications`): Specifications for owner, `deletedAt is null`, `q` (case-insensitive contains over title and stop city names, via EXISTS) and the date range; the repository extends `JpaSpecificationExecutor`. Then per matching trip `TripFigures` (no weather, no external I/O, one read-only transaction), the priority filter (in memory, because the priority facet needs the other priorities anyway), the mode filter (any leg's recommended mode), facets, `priorityTotals`, the sort (date in SQL order then id; cost/CO₂ in memory, trips without figures last in both directions, ties by date then id) and the page slice (skip/limit on the sorted list). Facets: each dimension counts trips matching all *other* filters (the priority chips ignore the priority filter, the mode chips the mode filter); `priorityTotals` describe the whole filtered result, not just the page
  - Stats (`TripStatsService`): over all active trips of the user, unaffected by list filters; today from `Clock`
  - Soft delete (`add-flyway-migration`): V9 adds `trip.deleted_at TIMESTAMP NULL` + index (owner_id, deleted_at). Explicit column and query conditions, not Hibernate `@SoftDelete`/`@SQLRestriction`, because restore must read deleted rows. All trip lookups (`...ByIdAndOwnerIdAndDeletedAtIsNull`), comparison, advice, update, delete and stats ignore deleted trips. Restore allowed while `now ≤ deletedAt + routewise.trips.restore-window` (`ROUTEWISE_TRIPS_RESTORE_WINDOW`, default `30s`), otherwise 409 via a new `ConflictException`; another user's trip → 404 on delete and restore. No purge job (in-memory database)
  - UI for undo: after a confirmed delete, the existing `ToastService` info toast "Trip deleted" with an Undo action calls restore and reloads the list and stats; no new component or style
  - Moscow (`add-flyway-migration`): V10 deletes trips that have a Moscow stop (their stops cascade; patching the stop list could leave fewer than 2 stops or consecutive duplicates), then the city; no existing migration edited; demo trips and seeder do not use Moscow
  - Unavailable groups: one entry per (leg, code) with the modes in the fixed order train, bus, car, bike, plane; messages: `DIFFERENT_LANDMASS` "Not reachable by land between A and B: …", `TOO_FAR` "Too far between A and B for: …"; totals: "Not possible for the whole trip: … (<leg reason>)", one entry per first blocking leg and code
  - Weather: `@Cacheable` on the weather client (Spring Cache + Caffeine, `expireAfterWrite` 1 h, max 1,000 entries, key = rounded latitude/longitude + date, configurable `routewise.weather.cache-ttl`); only successful answers are cached (including "no data for that date"), failures are not, so the next request tries again. Retry once on `RestClientException` with Spring Framework 7's built-in `@Retryable` (`@EnableResilientMethods`, 200 ms delay), no new dependency; cache outside retry, so a hit never retries. Timeouts unchanged (2 s connect / 3 s read, worst case per city about 10 s). `weatherStatus` on the comparison
  - AI advisor: timeout (20 s), 1 retry and the rule-based fallback already exist (2026-11-11 decisions); this milestone only adds the missing tests (timeout → rules)
  - Actuator: `spring-boot-starter-actuator`, default exposure (`health` only, no details), `/actuator/health` public in `SecurityConfig`
  - Auditing: `@EnableJpaAuditing` with a `DateTimeProvider` from `Clock`; `Trip.createdAt`/`updatedAt` and `AppUser.createdAt` via `@CreatedDate`/`@LastModifiedDate` instead of Hibernate's `@CreationTimestamp`/`@UpdateTimestamp`
  - ArchUnit (`archunit-junit5`, test scope): `..controller..` does not depend on `..repository..`; no `@Entity` class as a parameter or return type of a public `@RestController` method (enums and records in `domain` such as `TripPriority`, `AuthUser` are allowed); `..service..` does not depend on `..controller..`
  - Frontend (API calls only): `models.ts` (`TripPage`, `TripListItem`, `TripFigures`, `TripStats`, `UnavailableGroup`, `weatherStatus`); `TripApi.search(params)`, `stats()`, `restore(id)`; the Trips page sends search (debounced 300 ms), chips and sort to the API, reads KPIs from `stats()` and chip counts from `facets`, board column headers from `priorityTotals`; asks for `size=100` and shows no pagination controls yet (known limit: more than 100 matching trips are not all shown); a priority move re-fetches the list and stats instead of the trip's comparison
  - Docs: Swagger annotations on every new/changed endpoint and parameter; this file's API table and domain model; README "Data & assumptions" (149 cities without Moscow, list figures without weather, weather cache TTL)
  - Process: `add-rest-endpoint` and `add-flyway-migration` skills; `test-writer` agent for missing tests; `backend-reviewer` agent before committing, every 🔴 finding fixed; commits via the `commit` skill; never push
  - Done when: tests for the specifications (search on title and on a city name, each filter, combinations, deleted trips excluded), sorting (each key and direction, trips without figures last) and pagination (bounds, last page, out-of-range page = empty items), facet counts (own dimension ignored), `priorityTotals`, stats (no trips, deleted trips, trip without car, next trip today/past), soft delete and restore (inside the window, at the boundary, after → 409, not deleted → 200, another user's trip → 404, deleted trip → 404 on get/update/comparison/advice), `UnavailableGrouper` messages, weather cache hit/miss, failure not cached, retry then fallback with `weatherStatus` `UNAVAILABLE` on timeout, advisor timeout → rules, V9 and V10 migrations (a V8 database with a Moscow trip migrated: trip and city gone, others intact, 149 cities; `CityMigrationTest` count 150 → 149, the only changed expectation of an existing test), ArchUnit rules, `/actuator/health` public; frontend specs for the new `TripApi` calls, the Trips page using API figures/facets/stats, undo toast and grouped messages; `./mvnw verify`, `npm test` and `npm run lint` green; `docs/AI_WORKFLOW.md` entry
- [x] `feat/ui-reference-style`: full visual overhaul in the style of the design reference (`docs/photo.jpg`, look and layout ideas only); visual and interaction changes, no API change
  - Depends on `feat/backend-depth` (server-side search, facets, stats, pagination, soft delete + restore); no business calculations in the UI
  - Reference: `docs/photo.jpg` is a design reference only: copy its look and layout ideas, never its content, brand, texts or icons; never commit, move or copy it (git-ignored)
  - Screenshots (replaces the "no screenshots" rule): new devDependency `@playwright/test` (approved) with `npm run screenshots`, which logs in with the demo account against the running app and captures Home (empty and with a route), Home Map layout, Trips board, Trips list, trip details, trip form, Modes and the account menu at 1920/1280/375 px. Step reviews go to `docs/screenshots/work/` (git-ignored); final `before-*`/`after-*` sets go to `docs/screenshots/` and are committed. First, the missing current screens are captured: `before-trips-list-1920.png`, `before-account-menu.png`
  - Step 1 (stop for review): smoky multi-tone background (soft grey, olive and warm tones blended with the lime accent, blurred, static under reduced motion); the app inside a large rounded glass shell with a small outer margin; stronger glass tokens (translucent fill, visible blur, 1 px light border, large radii, pill controls); top bar: logo tile left with the Map/Split toggle next to it on Home only (same preference and breakpoints as now), centred pill nav (Home, Trips, Modes), round icon buttons and avatar right; left vertical glass icon rail from 1024 px (search, new trip, trips, modes; tooltips and labels for assistive tech), hidden on phones; dark theme only: `ThemeService`, the theme menu, the inline theme script, light tokens and every `data-theme` rule removed
  - Step 2 (stop for review): Trips board: each priority is a glass lane with a header (colour dot, name, count badge, total from `priorityTotals`, round "+" that opens New trip with that priority via the existing `priority` query parameter) and cards in a clearly coloured translucent tint per lane (new tint tokens per priority, AA-checked); List styling: glass table, sticky header
  - Step 3 (stop for review): Modes page (`/modes`, nav item, public): one glass card per mode from `GET /api/transport-modes` (speed, cost, CO₂, max distance) and a comparison chart (metric tabs, table equivalent), moved from Home; Home: animated route along the arc (flowing dash or a moving arrow, static under reduced motion); left panel actions "View trips" and "Describe a trip instead" full width, stacked, equal width; Tomorrow / This weekend / Next week as one full-width row of equal segments; comparison score bars proportional to the score (100 = full width); unavailable modes only as the API's grouped messages; globe labels: fewer at low zoom and no overlaps in dense areas (tighter rank and density rules in `globe.ts`, tested)
  - Step 4 (stop for review): account popover on the avatar (glass): avatar, name, email (`/api/auth/me`), trips planned and CO₂ saved (`/api/trips/stats`), "My trips" link, Log out with an icon; delete from card, row or trip details through a glass confirm dialog (focus trapped, Escape cancels, focus returns), then a toast "Trip deleted · Undo" shown for less than the restore window (10 s, window 30 s) that calls `POST /api/trips/{id}/restore`, and a clear error toast when the restore fails; interactive List: a row expands inline (legs with mode icons, time, cost and CO₂ per leg and the weather, from that trip's `GET /api/trips/{id}/comparison`, loaded on first expand) with Open on map, Edit and Delete; hover quick actions, server-side sortable columns, inline priority change (optimistic with rollback), pagination (page size 20 with page controls and the result count), keyboard: arrows move between rows, Enter expands, Escape collapses
  - Optional step 5 (only after its own approval): Preferences (default priority, default travelers, home city) in the account popover; needs a new `GET/PUT /api/me/preferences`, a Flyway migration and tests; planned here, not built unless approved
  - Building blocks in `shared/ui`: glass shell, icon rail, lane, popover, dialog; existing pill nav, toast, menu, cards reused and restyled; tokens only, no hard-coded colours
  - Accessibility and performance: WCAG AA on glass (contrast check composites over the brightest background area), visible focus, `prefers-reduced-motion` and `prefers-reduced-transparency`; few stacked `backdrop-filter` layers (shell, top bar, rail, panels, popover, dialog), none per card or row; globe and scrolling stay smooth; layouts at 375/768/1280/1920 px
  - Unchanged: backend, API contracts, routes other than the new `/modes`, URL state of the explorer
  - Process: `ui-builder` builds each step, `ui-reviewer` reviews before each commit (all 🔴 fixed); stop after each step with `work/` screenshots; commits via the `commit` skill; never push
  - Done when: specs updated for changed markup (no test deleted without a stated reason) and new specs for the shell, rail, lanes, Modes page, route animation (reduced motion), label density, account popover, confirm dialog, Undo toast and restore failure, list expansion, pagination and keyboard navigation; `npm run lint`, `npm test` and `./mvnw verify` green; `after-*` screenshots of every screen at 1920/1280/375 in `docs/screenshots/`; `docs/AI_WORKFLOW.md` entry
- [x] `feat/living-globe`: an idle-rotating globe with a "My trips" layer, flatter route arcs, a New trip page whose panels fill the height and a more readable Modes page (frontend only, no API change)
  - Depends on `fix/ui-polish` and `fix/ui-review-findings` (merged)
  - Idle rotation on maps with no route selected (Home, New trip): a full turn in about 2 minutes; stops at once on hover, drag, wheel/zoom, keyboard use or a selected route, resumes after 10 s without interaction; off under `prefers-reduced-motion`, paused while the tab is hidden; reuses the per-frame re-projection that dragging uses
  - "My trips" layer on Home (logged in): the next 20 upcoming trips from `GET /api/trips?from=<today>&sort=date&direction=asc&size=20` (deleted trips are excluded by the API), placed with the city list Home already loads; thin, low-opacity lifted arcs without animation that fade further while a route is selected; hover shows a small glass tooltip (title, date), click opens the trip (a wider invisible stroke as hit area); toggle "Show my trips" next to the zoom controls, saved in `localStorage` (try/catch), default on; the arcs are a pointer convenience hidden from assistive tech, the same trips stay reachable through Upcoming trips and the Trips page
  - Flatter arcs: lift per radian 0.5 → 0.25 and maximum 30 % → 15 % of the radius, also for the "My trips" arcs
  - New trip from 1280 px: the three columns have equal height and fill the viewport; the description textarea and the Notes field grow into the free space; the Create/Cancel bar sits at the bottom inside the form panel (same glass, rounded bottom corners); "What matters most?" as a 2×2 grid (one row only if all four fit), never one option alone on a line
  - Modes page at the Trips width (84rem): cards with label left and value right on one line, values slightly larger; cards wrap 5 → 3+2 → 2 → 1; the chart uses the full width and the best mode for the shown metric gets the accent, the others a muted tone
  - Done when: Playwright at 1920 and 1440 shows no page scroll on Home and New trip, no overflow in "What matters most?" and Modes values on one line; a frame-time probe while rotating with the trips layer on shows no long frames; specs for rotation start/stop/resume (fake timers, reduced motion, hidden tab), the trips layer (data, toggle and storage failure, tooltip, click, fade), the flatter arc values, the New trip layout and the Modes chart accent; `ui-reviewer` 🔴 fixed; `npm run lint` and `npm test` green
- [x] `feat/parser-relative-dates`: the rule-based trip parser understands more relative dates
  - "this weekend" (Saturday, or today on Saturday or Sunday, like the UI shortcut) and "next weekend" (the Saturday after that) are new; "next week" becomes next Monday, matching the UI shortcut (was today + 7); today, tomorrow, "in N days/weeks", "next <weekday>" (its next occurrence after today) and explicit dates such as "Dec 4" keep working
  - Done when: a unit test per expression with a fixed clock (hand-computed dates, incl. Saturday/Sunday edge cases); `backend-reviewer` 🔴 fixed; `./mvnw verify` green
- [ ] `docs/readme-demo`: README and demo recording
- [x] `feat/trip-details-redesign`: a more readable and interactive trip details page (reference: `docs/trips_details.png`, local and git-ignored; frontend only, no API change)
  - Depends on `fix/ui-cleanup` (comparison chart accent and priority line)
  - Header: title, then the route as one horizontal stop chain (city chips with arrows, wrapping, a repeated city shown again: Berlin → Prague → Vienna → Munich → Berlin) instead of a numbered list in a box; date (one line, e.g. "Sat, 5 Dec 2026"), travelers and priority as `StatChip`s in one row; notes as a quiet line under them; Edit and Delete stay
  - Layout from 1280 px: content at the left, the globe in a larger glass panel at the right that stays in view while the page scrolls (sticky); below 1280 px the globe sits under the header at full width
  - Interactive globe: the details map becomes interactive (drag, zoom, +/−, Reset, keyboard) with `cooperative` gestures because the page scrolls; it still opens on the route and does not idle-rotate
  - Recommendation: the key figures first (total time, cost and CO₂ of the recommended plan as `StatChip`s, from the comparison's `recommendedItinerary`), then the advisor's summary; the leg sentences become a leg timeline (one row per leg: number, mode icon from `recommendedModes`, the API's sentence); tips as compact callouts; the advisor source badge stays. API text is shown as is, never re-worded or parsed
  - Map and legs linked: hovering or focusing a leg row (recommendation timeline or itinerary view) highlights that leg on the globe and dims the others; the globe turns to it if it is out of view; leaving restores the whole route. Pointer and keyboard both work, and the leg stays readable without the map (text first)
  - Done when: Playwright captures of the details page (2-stop and 5-stop trip) at 1920/1280/375 px as `before-`/`after-trip-details-*` in `docs/screenshots/`; specs for the stop chain, the chips, the figures, the leg timeline and the leg highlight (hover, focus, leave); `ui-reviewer` 🔴 fixed; `npm run lint` and `npm test` green

## Decisions

Decisions and their reasons are logged in [`docs/DECISIONS.md`](DECISIONS.md).

## Backlog / ideas

Not planned yet; each item becomes a milestone (via `add-milestone`) before any code is written.

- Connecting flights via hubs for very long routes: distance, time and CO₂ calculated per flight segment, hub chosen to minimise detour.
