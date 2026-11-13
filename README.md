# RouteWise

Multimodal trip planner that compares train, bus, car, bike and plane
by travel time, cost and CO₂ emissions, with an AI travel advisor.

> 🚧 Work in progress.

## How to run

Requirements: Java 21 and a current Node.js LTS (developed with Node 24).
No database, API key or other configuration is needed.

```bash
# Terminal 1: API on http://localhost:8087
cd backend && ./mvnw spring-boot:run

# Terminal 2: UI on http://localhost:4200
cd frontend && npm install && npm start
```

Open http://localhost:4200 and log in with the **demo account**:

| Email | Password |
|---|---|
| `demo@routewise.app` | `demo1234` |

Or click **Try the demo** on the login page. The demo account comes with
three sample trips. You can also create your own account; trips are private
to the account that saved them.

The database is in memory, so every restart begins with only the demo
account and its sample trips.

Optional settings (environment variables):

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Enables the AI advisor; without it, rule-based advice is used |
| `ROUTEWISE_DEMO_ENABLED` | `true` | Set to `false` to skip the demo account (do this for any real deployment) |
| `ROUTEWISE_SESSION_TIMEOUT` | `2h` | How long a login lasts without activity |
| `SERVER_PORT` | `8087` | API port |

API documentation: http://localhost:8087/swagger-ui.html

## Data & assumptions

RouteWise gives estimates for comparing options, not quotes or timetables.

- **Cities:** 149 capitals and major transport hubs on every continent,
  seeded by Flyway migrations (`V2`, `V7`; flight factors in `V8`; Moscow
  removed again in `V10`). Coordinates are city centres.
- **Distance:** great-circle (haversine) distance between the cities, times a
  detour factor per mode (train 1.2; bus, car and bike 1.3; plane 1.0).
- **Prices:** one cost per kilometre per mode, used worldwide. These are rough
  global estimates; real fares vary widely by country, season and operator.
- **Ground modes and landmasses:** train, bus, car and bike are only offered
  when both cities are on the same *landmass*, a region joined by land, and the
  route is within the mode's maximum distance. Fixed links count: the Channel
  Tunnel and the Øresund and Great Belt bridges make Great Britain and the
  Danish islands part of Eurasia. Ferries do not: Ireland, Iceland, Japan,
  Australia, New Zealand and other islands are separate landmasses. Africa is
  treated as separate from Eurasia. Otherwise the mode is shown as unavailable
  with a reason (`DIFFERENT_LANDMASS` or `TOO_FAR`).
- **Flight CO₂:** two factors per passenger-km from the UK DEFRA greenhouse
  gas conversion factors 2023 (economy class, including radiative forcing):
  short-haul 183 g up to 3,700 km great-circle distance (DEFRA's short/long-haul
  boundary), long-haul 200 g above it. The factor depends on the leg's distance.
- **Other CO₂ and speeds:** typical European averages per mode (car per
  vehicle, shared by up to five travellers; others per traveller).
- **Weather:** Open-Meteo forecasts for today and the next 15 days, cached per
  city and date for an hour (`ROUTEWISE_WEATHER_CACHE_TTL`). A failed call is
  retried once; if the forecast is still missing the comparison works without
  it and says so (`weatherStatus`).
- **Trip list and KPIs:** the figures on the Trips page (cost, CO₂, CO₂ against
  the car, average cost, CO₂ saved) are computed **without weather**, so the
  list needs no external call. For a trip in the next two weeks the details
  page, which does use the weather, can recommend another mode (e.g. no bike in
  rain).
- **Deleted trips** can be restored for 30 seconds (`ROUTEWISE_TRIPS_RESTORE_WINDOW`).
- **Map:** land and borders from Natural Earth 1:110m (public domain).
