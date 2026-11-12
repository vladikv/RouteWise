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
