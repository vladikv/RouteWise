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
- [ ] `feat/living-globe`: an idle-rotating globe with a "My trips" layer, flatter route arcs, a New trip page whose panels fill the height and a more readable Modes page (frontend only, no API change)
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
| 2026-11-13 | The backend owns trip figures, filtering, facets, sorting and KPIs; the UI only displays them | One source of truth, testable in plain Java; the Trips page no longer needs one comparison request per trip. Supersedes "Trips page figures come from one `GET /api/trips/{id}/comparison` per trip" |
| 2026-11-13 | List and stats figures are computed in memory without weather; stored columns (owner, deleted, title, cities, priority, date) are filtered with Specifications in SQL, mode filter, cost/CO₂ sort and paging run in Java | Human choice. Keeps "comparison computed, not stored" and keeps the list free of external I/O; fine for per-user lists. Weather is a short-term adjustment shown on the details page, so a trip in the next 16 days can differ there (e.g. bike in rain) |
| 2026-11-13 | `GET /api/trips` returns a page with facets instead of an array (breaking) | Pagination and facet counts need an envelope; the UI is the only client and changes in the same milestone |
| 2026-11-13 | Facets count with every filter except their own dimension | Each chip then shows how many trips it would add; counting from the full list ignored search and dates |
| 2026-11-13 | Soft delete with an explicit `deleted_at` column, not Hibernate `@SoftDelete` | Restore has to load the deleted row, which `@SoftDelete` hides from every query |
| 2026-11-13 | Restore after the window → 409; restoring a trip that is not deleted → 200 | 409 matches "the state no longer allows this"; an idempotent restore survives a double-clicked Undo |
| 2026-11-13 | Moscow removed by V10, which deletes trips with a Moscow stop instead of editing their stops | Never edit a migration; removing one stop could leave an invalid stop list, and the in-memory database has no real user data at migration time |
| 2026-11-13 | Added Caffeine + `spring-boot-starter-cache`, `spring-boot-starter-actuator`, `archunit-junit5` (test) | Human approved. Caffeine: per-entry TTL, which the default `ConcurrentMap` cache lacks; Actuator: standard health check; ArchUnit: layering rules as tests |
| 2026-11-13 | Retry with Spring Framework 7's built-in `@Retryable`, not Spring Retry or Resilience4j | Comes with the framework, no new dependency; one retry is all that is needed |
| 2026-11-13 | Weather cache holds successes only, keyed by rounded coordinates and date, TTL 1 h | A failure must not be remembered for an hour; forecasts change slowly enough for an hour |
| 2026-11-13 | Unavailable modes grouped per leg and code with a server-written message; the per-option `unavailableReason` stays | One readable sentence instead of one per mode, without the UI parsing English text; additive, no breaking change |
| 2026-11-13 | Auditing timestamps via Spring Data JPA auditing with a `Clock`-backed `DateTimeProvider` | Timestamps become testable with `Clock.fixed`, like every other date rule |
| 2026-11-13 | The priority filter of `GET /api/trips` runs in memory, not as a Specification | The priority facet must count every priority anyway, so one SQL query (owner, active, text, dates) serves the result and both facets |
| 2026-11-13 | The per-leg loop moves from `ComparisonService` into a pure `RoutePlanner`, shared by comparisons (with weather) and trip figures (without) | One place computes legs, itinerary, totals and grouped reasons, so list figures and the comparison can never disagree except for the weather |
| 2026-11-13 | Cache and retry proxies on the weather client are class-based (`proxyTargetClass = true`) | Spring's retry interceptor reads `@Retryable` from the invoked method; through the `WeatherClient` interface proxy it saw no annotation and never retried (caught by `WeatherClientResilienceTest`) |
| 2026-11-13 | Soft-deleted trips are never purged; the restore window must be at least 1 s | The database is in memory, so rows vanish on restart; a zero or negative window would turn every Undo into a 409 without any startup error |
| 2026-11-13 | The table's sort only applies in the list view; the board always shows date order | Sorting cards inside priority columns by cost was never a feature; keeping the board unchanged avoids a visible change |
| 2026-11-13 | The Trips page keeps the previous page visible while a new search loads (`linkedSignal` over the resource) | Without it every keystroke would replace the toolbar with a spinner and drop the search field's focus |
| 2026-11-13 | Board column counts are the cards shown while the page holds every matching trip, else the API's `priorityTotals` count; totals always come from the API | With the API count only, a card moved optimistically into a column the API counted as empty was hidden until the reload (caught by the test agent) |
| 2026-11-13 | Clearing the filters applies the empty search at once; the search query is compared by value | The debounced search and a new query object on every view switch sent redundant requests |
| 2026-11-13 | Screenshots return: `@playwright/test` (devDependency) and `npm run screenshots`; step reviews in `docs/screenshots/work/` (git-ignored), final `before-*`/`after-*` sets in `docs/screenshots/` (committed); only `docs/photo.jpg` and `work/` are ignored | Human decision for `feat/ui-reference-style`: the look is steered visually step by step, which code review cannot do. Supersedes "No screenshots" |
| 2026-11-13 | Dark theme only again; the light theme, theme menu and their tokens are removed | Human decision: the reference look is dark glass; one theme halves the contrast checks. Supersedes "Light, dark and system themes return" |
| 2026-11-13 | Deleting a trip uses a glass confirm dialog followed by an Undo toast | Requested with the reference style; Undo makes the dialog the only extra step. Supersedes "Delete needs an inline second confirmation, no modal dialog" |
| 2026-11-13 | "How the modes compare" moves from Home to its own Modes page (`/modes`) | Home stays focused on the map and the comparison; mode parameters get room for a card per mode and a chart |
| 2026-11-13 | A list row loads its trip's comparison only when it is first expanded | Legs, per-leg figures and weather already come from `GET /api/trips/{id}/comparison`; no new endpoint and no request per row up front |
| 2026-11-13 | Preferences in the account menu are an optional step needing its own approval | No endpoint exists; the milestone otherwise changes no backend or API contract |
| 2026-11-13 | Optional step 5 (Preferences) not built | Human decision when closing `feat/ui-reference-style`; stays a candidate for a later milestone |
| 2026-11-13 | Glass: a static smoky backdrop (no drift) behind one shell at midnight 50 %; chips, cards and rows have no blur of their own | The drifting glow made the full-viewport shell blur repaint every frame; the reference look comes from the backdrop, not from stacked blurs |
| 2026-11-13 | Muted text raised to `#e2e6ed` | Keeps 4.5:1 on 12 % controls at the brightest backdrop point; hierarchy now comes more from size and weight than colour |
| 2026-11-13 | Board cards are tinted per priority lane (blue, rust, olive, grey), no longer per mode; the mode stays written on the card | Matches the reference's coloured columns and ties each card to its lane; colour is never the only signal |
| 2026-11-13 | Globe labels: rank 2 from 2.5x, rank 3 from 5x, a zoom-dependent minimum gap for low-rank dots, more label padding; route cities and the keyboard-focused city are always drawn | Europe at low zoom was crowded with dots and near-touching labels |
| 2026-11-13 | Account popover built on the existing `Menu` (new `focusOnOpen`) instead of a separate popover component | Escape, outside click, focus return and ARIA were already there; one disclosure component to maintain |
| 2026-11-13 | The Undo toast takes keyboard focus; toasts get a per-toast duration (Undo 10 s, default 5 s) | The control that opened the delete dialog disappears with the trip, so without moving focus Undo was out of reach within its time limit (WCAG 2.2.1) |
| 2026-11-13 | List rows: the expand button is the roving tab stop (arrows, Home/End), Enter/Space expand, Escape collapses; the list pages by 20, the board still loads up to 100 | One tab stop for the table with native button semantics; the board needs every trip of a lane at once |
| 2026-11-13 | Final screenshots: the previous `after-*` set became this milestone's `before-*` set; the older glass-redesign `before-*` files were replaced (still in git history) | One committed before/after pair per screen instead of three generations |
| 2026-11-13 | `fix/ui-polish`: small UI polish of merged features (no new milestone): Home without page scroll, single-select quick dates, glass globe, lifted route arcs, New trip page in three columns, icon rail with global tools | Requested as polish of what the merged milestones built; the features already exist, only their presentation and behaviour change |
| 2026-11-13 | Home and the New trip page fill `--stage-height` (viewport less header, shell margins, footer and border) from 1024/1280 px; long columns scroll inside themselves, the page never does | Lets the globe size itself from the height; at 1440x900 the Map dock and the trip form's fields scroll inside their panel instead of the page |
| 2026-11-13 | A cleared quick date clears the date: no comparison, no weather, nothing written to the URL | The user asked for deselect to clear; an empty date cannot be compared, and the URL keeps only valid state |
| 2026-11-13 | Route arcs are lifted above the globe (peak 2-30 % of the radius, by leg angle) but follow the great circle | Reads as an arc like the first flat-map version while still matching the calculated distance |
| 2026-11-13 | The trip form's globe moved out of the stops fieldset into its own column (`TripForm` host `display: contents`) | Three columns need the globe beside the fields; keeping it in `TripForm` keeps the map-to-stop logic in one place |
| 2026-11-13 | Icon rail: Search (palette), New trip, Upcoming trips, Keyboard shortcuts; Trips and Modes removed | They duplicated the top nav; the rail now holds tools that work on every page |
| 2026-11-13 | Search palette uses the existing `GET /api/cities?q=` and `GET /api/trips?q=&size=5`; a city fills Home's From, or To once From is set; trips only when logged in | No new endpoint; one predictable rule for where a city goes |
| 2026-11-13 | "Upcoming trips" are the next 5 trips from today (`sort=date&direction=asc&from=<today>&size=5`) | Useful for planning and needs no creation-date sort, so the API contract stays unchanged |
| 2026-11-13 | New `Modal` (native `<dialog>`, any content) beside the confirm `Dialog`; `Menu` gets an `end` placement, opaque when opened from the rail | The palette and the shortcuts list ask no question; the rail's backdrop filter keeps a nested panel from blurring the page |
| 2026-11-13 | The header's search button (below 1024 px) still opens the Trips search; Ctrl/Cmd + K opens the palette at every width | Keeps the phone flow unchanged; the palette is a keyboard tool |
| 2026-11-14 | Modes chart: the best mode for the shown metric gets the accent, the others a muted tone | Human choice; matches the comparison chart on Home, where only the recommended mode is lime |
| 2026-11-14 | Parser "next week" means next Monday (was today + 7) | Human choice: the parser and the UI shortcut must agree on what "next week" is |
| 2026-11-14 | The "My trips" globe layer uses the existing trip search (next 20 upcoming), no new endpoint | Enough to show where the user travels without clutter; the API contract stays unchanged |
| 2026-11-14 | Parser: a weekday named with a weekend ("sunday this weekend") picks that day of the weekend; "the weekend" counts as this weekend | Found by the backend review; without it the Saturday won over the named Sunday |

## Backlog / ideas

Not planned yet; each item becomes a milestone (via `add-milestone`) before any code is written.

- Connecting flights via hubs for very long routes: distance, time and CO₂ calculated per flight segment, hub chosen to minimise detour.
