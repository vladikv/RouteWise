---
name: run-app
description: Starts the RouteWise application locally (API, and UI if it exists) in the background and reports the URLs. Use whenever the user asks to run, start or launch the app or program, in any language.
---

# Run the app

1. Check what exists:
  - root `package.json` with a `dev` script → full app
  - otherwise only `backend/` → API only
2. Check if ports 8087 / 4200 are already in use. If the app is already
   running, don't start a second copy; just report the URLs.
3. Start in the **background** (never block the session):
  - full app: `npm run dev` in the repo root
    (run `npm install` first if `node_modules/` is missing)
  - API only: `./mvnw spring-boot:run` in `backend/`
4. Wait until it is ready (max ~90s):
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
