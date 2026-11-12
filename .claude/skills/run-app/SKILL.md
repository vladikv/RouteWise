---
name: run-app
description: Starts the RouteWise application locally (API, and UI if it exists) in the background and reports the URLs. Use whenever the user asks to run, start or launch the app or program, in any language.
---

# Run the app

1. The app has two parts, started separately: the API (`backend/`) and
   the UI (`frontend/`). There is no root `package.json`.
2. Check if ports 8087 / 4200 are already in use. Start only the parts
   that are not running; if both are up, just report the URLs.
3. Start each part as its own **background** process (never block the
   session), logging to a file in the scratchpad:
  - API: `./mvnw spring-boot:run` in `backend/`
  - UI: `npm start` in `frontend/`
    (run `npm install` there first if `frontend/node_modules/` is missing)
4. Wait until both are ready (max ~120s, polled in one loop):
  - API: `curl -s http://localhost:8087/v3/api-docs` returns 200
  - UI: `curl -s http://localhost:4200` returns 200
5. Report, short:
  - ✅ / ❌ per part
  - UI: http://localhost:4200
  - Swagger: http://localhost:8087/swagger-ui.html
  - H2 console: http://localhost:8087/h2-console (JDBC URL `jdbc:h2:mem:routewise`)
6. If startup fails, show the relevant error lines from the log and
   suggest a fix. Do not change code without asking.

To stop: when the user asks to stop the app, stop the background
processes started by this skill.
