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
- **LLM provider**: optional, via env variable; behind an `AdvisorClient`
  interface with a rule-based implementation as fallback

## Milestones

- [x] `chore/ai-dev-setup`: CLAUDE.md, subagents, skills, hooks
- [ ] `feat/backend-setup`: Spring Boot scaffold, H2, Flyway, error handling, OpenAPI, CORS
- [ ] `feat/backend-trips`: City/TransportMode seed data, Trip CRUD + tests
- [ ] `feat/backend-comparison`: comparison engine + weather integration + tests
- [ ] `feat/ai-advisor`: advisor parse/advice endpoints with fallback + tests
- [ ] `feat/frontend-setup`: Angular scaffold, layout, API client, theming
- [ ] `feat/frontend-trips`: trip list, form, details, delete
- [ ] `feat/frontend-comparison`: comparison view, advice panel, free-text input
- [ ] `docs/readme-demo`: README, screenshots, demo recording

## Decisions log
| Date | Decision | Reason |
|---|---|---|
| 2026-11-10 | H2 in-memory + Flyway | Zero-setup run; schema still versioned like production |
| 2026-11-10 | Comparison computed, not stored | Always reflects current mode parameters; less state |
| 2026-11-10 | Open-Meteo for weather | Free, no key, keeps zero-config promise |
| 2026-11-11 | Root + module CLAUDE.md files | Module rules load only when relevant |
