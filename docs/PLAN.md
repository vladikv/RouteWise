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
- Interactive globe map and about 420 cities on every continent; ground modes only between
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
- About 420 cities: at least two per US state plus Washington, more regional cities and the remaining capitals
  in Europe, and major cities in large countries worldwide
- Regional cost estimates: car cost from country fuel prices and tolls, train/bus/plane from regional
  base fares plus a per-km price, all in EUR and shown as an estimate
- Flights only where both cities have a working airport (e.g. none from Ukrainian cities while the airspace is
  closed); otherwise the plane is unavailable with a clear reason *(planned: `feat/airport-availability`)*
- Optional live flight prices: with an API key configured, the comparison shows the cheapest real flight offer
  for the date instead of the estimate; without a key everything works as before *(planned:
  `feat/live-flight-prices`)*

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
*(changed in `feat/more-cities`: 273 more seeded cities, 422 in total, no new fields; names are unique across all
countries, since the parser and the advisor resolve cities by name; new island landmasses such as HAWAII, SICILY,
SARDINIA, CRETE, TASMANIA and SOUTH_ISLAND)*
*(planned in `feat/airport-availability`: `airportCode` (IATA code of the city's main working airport, 3 capital
letters; `null` = no working airport, e.g. every Ukrainian city while the airspace is closed), seeded for all
cities by a new migration)*

**TransportMode**: seeded reference data
`code (TRAIN|BUS|CAR|BIKE|PLANE), avgSpeedKmh, costPerKm, co2GramsPerKm, fixedOverheadMinutes, maxDistanceKm`
*(changed in `feat/regional-pricing`: `costPerKm` is the fallback used where no regional price exists, and always
for BIKE)*

**CountryPricing**: seeded reference data *(new in `feat/regional-pricing`, V12/V13)*
`country (ISO alpha-2, PK), region, fuelEurPerLitre, tollEurPerKm` — one row per country in the city table;
a dated snapshot of public fuel prices (EU Weekly Oil Bulletin, US EIA, GlobalPetrolPrices), converted to EUR.

**RegionalFare**: seeded reference data *(new in `feat/regional-pricing`, V12/V13; 12 regions, Japan separate)*
`region, modeCode (TRAIN|BUS|PLANE), baseFareEur, costPerKm` — average published fares per region.

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
*(changed in `feat/regional-pricing`)* Cost per leg: CAR = cars × routeKm × (6.5 l/100 km × fuel price + toll per km),
with fuel and toll averaged over the leg's two countries; TRAIN/BUS/PLANE = travelers × (base fare + per-km price ×
routeKm) of the leg's region (averaged when the two cities are in different regions); BIKE = 0. Without a regional
row the mode's `costPerKm` is used as before. The figures are estimates, not real fares; the UI says so next to the
comparison (the option `notes` do not carry the pricing basis, so the advisor text stays free of it).
*(planned in `feat/airport-availability`)* PLANE is available only when both cities of the leg have an
`airportCode`; otherwise it is unavailable with `unavailableCode` `NO_AIRPORT` ("No working airport in Kharkiv"),
grouped like the other codes. The user can add a stop with an airport by hand (London → Krakow → Kharkiv).
*(planned in `feat/live-flight-prices`)* With a flight price API key, the PLANE cost of a leg in a comparison is
the cheapest live offer for the leg's airports and date × travelers; without a key, without offers or on any
provider error it stays the regional estimate. Each option says where its cost comes from (`costSource`). The
trip list and stats always use estimates, so they never call an external service.
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

`feat/more-cities` and `feat/regional-pricing` change no endpoint or DTO: `GET /api/cities` returns more rows
*(done in `feat/more-cities`)*, and comparison, trip list and stats costs change in value only (currency stays EUR)
*(done in `feat/regional-pricing`)*.
`GET /api/transport-modes` keeps `costPerKm`, now the fallback price.

Planned, additive only (no field removed or renamed):
- `feat/airport-availability`: `GET /api/cities` gets `airportCode`; `unavailableCode` and
  `unavailableGroups[].code` get the new value `NO_AIRPORT` (clients must accept an unknown code).
- `feat/live-flight-prices`: comparison options (`GET /api/trips/{id}/comparison`, `POST /api/comparisons`) get
  `costSource` (`ESTIMATE` | `LIVE`) and `costRetrievedAt` (time of the live offer, `null` for estimates); the
  advice endpoint uses the same figures. Trip list and stats responses do not change.

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
- **Flight price API** *(planned: `feat/live-flight-prices`)*: optional, via `ROUTEWISE_FLIGHT_PRICES_API_KEY`;
  behind a `FlightPriceClient` interface, with the regional estimate as fallback. The provider is chosen at the
  start of the milestone (Skyscanner's API is for partners only)

## Milestones

Completed milestones are one line each; their details live in the commits, `docs/AI_WORKFLOW.md` and
`docs/DECISIONS.md`. A planned milestone keeps its full scope and "Done when" until it is done.

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
- [x] `feat/ui-glass-redesign`: glassmorphism redesign of the Angular UI: map-first Home on wide screens with floating panels, Trips page with KPIs, filters and board/list view, bottom sheet on phones; visual and layout only
- [x] `feat/globe-map`: interactive globe map, about 150 worldwide cities, landmass-based mode availability and split flight CO₂ factors
- [x] `feat/backend-depth`: the backend owns the business logic (trip search, figures, facets, stats, grouped unavailable messages), soft delete with undo, resilient weather calls, auditing and architecture tests; the UI only displays
- [x] `feat/ui-reference-style`: full visual overhaul in the style of the design reference (`docs/photo.jpg`, look and layout ideas only); visual and interaction changes, no API change
- [x] `feat/living-globe`: an idle-rotating globe with a "My trips" layer, flatter route arcs, a New trip page whose panels fill the height and a more readable Modes page (frontend only, no API change)
- [x] `feat/parser-relative-dates`: the rule-based trip parser understands more relative dates
- [ ] `docs/readme-demo`: README and demo recording
  - README for reviewers: features, screenshots from `docs/screenshots/`, quick start with the demo account, every
    environment variable with its default, a short "how it works", architecture and API overview, test commands
    (`./mvnw verify`, `npm test`, `npm run lint`, `npm run e2e`, `npm run screenshots`), project structure, "Data &
    assumptions", known limitations and how Claude Code was used; "Work in progress" banner removed
  - Demo script: a scene-by-scene plan for a 5–6 minute recording, kept by the human outside the repository
  - Recording: done by the human from that script; its link goes into the README's Demo line
  - Done when: the README matches the code (demo trips, variables, endpoints, test counts); `./mvnw verify`,
    `npm test` and `npm run lint` green; the recording is linked from the README
- [x] `feat/trip-details-redesign`: a more readable and interactive trip details page (reference: `docs/trips_details.png`, local and git-ignored; frontend only, no API change)
- [x] `feat/more-cities`: 422 seeded cities (at least two per US state, more of Europe, major cities worldwide); data only, no API change
- [x] `feat/regional-pricing`: cost estimates from seeded country fuel prices, tolls and regional fares (no API keys, no API change)
- [ ] `feat/airport-availability`: the plane is offered only between cities with a working airport
  - Why: London → Kharkiv showed a direct 5 h 53 min flight, but Kharkiv has no flights (Ukrainian airspace is
    closed); the engine treated every city as having an airport
  - Data: a new migration adds `city.airport_code VARCHAR(3) NULL` and seeds the IATA code of each city's main
    working airport for all 422 cities; `NULL` for every UA city and any city without an airport of its own
  - Engine: `ComparisonInput` carries whether both ends have an airport; `ModeAvailability.check` returns
    `NO_AIRPORT` for PLANE otherwise; `UnavailableGrouper` writes the grouped message
  - API: additive (`airportCode`, `NO_AIRPORT`), see the API section
  - UI: a readable message for `NO_AIRPORT` wherever unavailable reasons are shown; when a leg has no available
    mode, a hint to add a stop in between
  - Advisor: never recommends a flight on such a leg (the engine already picks the mode; check the rule-based
    texts and the Claude prompt facts)
  - Done when: London → Kharkiv shows PLANE as `NO_AIRPORT` and London → Krakow → Kharkiv gives a plan; unit tests
    for `ModeAvailability`/`ComparisonEngine`, a test that every seeded `airport_code` is `NULL` or three capital
    letters, UI tests for the message; `./mvnw verify`, `npm test` and `npm run lint` green
- [ ] `feat/live-flight-prices`: real flight prices in comparisons when an API key is configured
  - Why: estimated plane costs can be far from what flight search sites show for a date
  - Step 0: compare flight price APIs (e.g. Duffel, SerpApi Google Flights, Amadeus): sign-up open to new users,
    free tier, caching and display terms, search by IATA codes and date; the human picks one; record it in
    `docs/DECISIONS.md`; no new dependency unless approved (prefer `RestClient`)
  - Backend: a `flightprice` feature with `FlightPriceClient` (interface + implementation),
    `FlightPriceProperties` (`routewise.flight-prices.*`: key from `ROUTEWISE_FLIGHT_PRICES_API_KEY`, timeouts,
    cache TTL); the client bean exists only with a key; Caffeine cache (key: from/to airport, date, travelers;
    successes only) and one retry, as for the weather client; `FlightPriceService` returns empty on any failure
  - Engine: the live price is passed in as input (no I/O in `ComparisonEngine`); PLANE cost = cheapest offer ×
    travelers when present, otherwise `CostModel`; only `POST /api/comparisons`, the trip comparison and the advice
    use it, the trip list and stats keep estimates
  - Depends on `feat/airport-availability` (the IATA codes)
  - UI: a "live price" or "estimate" label next to the plane cost; the "costs are estimates" note only where an
    estimate is shown
  - Done when: with a key, London → Krakow shows a live plane price and `costSource` `LIVE`; without a key, or when
    the provider fails or times out, the same estimate as today; client tests with `MockRestServiceServer`
    (success, no offers, server error, timeout), a timeout test against a local `HttpServer`, service fallback,
    engine and controller tests; `./mvnw verify`, `npm test` and `npm run lint` green

## Decisions

Decisions and their reasons are logged in [`docs/DECISIONS.md`](DECISIONS.md).

## Backlog / ideas

Not planned yet; each item becomes a milestone (via `add-milestone`) before any code is written.

- Connecting flights via hubs for very long routes: distance, time and CO₂ calculated per flight segment, hub chosen to minimise detour.
