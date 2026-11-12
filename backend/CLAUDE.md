# RouteWise API (backend)

Spring Boot 4.1 REST API, Java 21, Maven. Read the root `CLAUDE.md` first;
this file adds backend-specific rules.

## Layout

Package-by-feature under `com.routewise`. Each feature owns its layers:

```
com.routewise
├── common/
│   ├── config/       cross-cutting config: CORS, security, OpenAPI, Clock
│   └── exception/    RouteWiseException hierarchy, GlobalExceptionHandler
└── <feature>/        e.g. trip, city, comparison, weather, advisor, user
    ├── controller/   @RestController, DTOs in/out only
    ├── service/      business logic, transactions, pure rule classes
    ├── repository/   Spring Data JPA interfaces
    ├── domain/       JPA entities, enums, plain domain records (engine input/output)
    ├── dto/          request/response records
    ├── mapper/       entity ↔ DTO mapping
    ├── client/       external API client: interface + implementation (if any)
    └── config/       the feature's @ConfigurationProperties and beans (if any)
```

A feature only has the subpackages it needs (`weather` has no controller or
repository; `city` has no client).

Resources: `application.yml`, Flyway migrations in `src/main/resources/db/migration/`.

## Commands

| Task | Command |
|---|---|
| Run | `./mvnw spring-boot:run` |
| Run on another port | `SERVER_PORT=8081 ./mvnw spring-boot:run` (default port: 8087) |
| Build + all tests | `./mvnw verify` |
| Single test class | `./mvnw test -Dtest=GlobalExceptionHandlerTest` |

Base URL: http://localhost:8087 · Swagger UI: `/swagger-ui.html` · OpenAPI JSON: `/v3/api-docs` ·
H2 console: `/h2-console` (JDBC URL `jdbc:h2:mem:routewise`, user `sa`, empty password).

## Conventions

- **DTOs are Java records.** Request records carry Bean Validation
  annotations and are bound with `@Valid`. Entities never leave the service layer.
- **Constructor injection only.** `final` fields, no field `@Autowired`.
- **Lombok only on JPA entities** (`@Getter`, `@Setter`, `@NoArgsConstructor`).
  Never `@Data` on entities (breaks `equals`/`hashCode` with lazy relations).
  No Lombok on services, controllers, DTOs or config.
- **Errors:** throw a `RouteWiseException` subclass: `ResourceNotFoundException` (404)
  or `FieldValidationException` (400 with an `errors` entry, for business rules on a
  specific field, e.g. an unknown city id), or `DuplicateFieldException` (409 with the
  same `errors` entry, for a taken unique value such as a registered email).
  `GlobalExceptionHandler` turns them into RFC 7807 Problem Details
  (`application/problem+json`). Do not use `ResponseStatusException` and do not
  build error bodies in controllers. Validation errors use the `errors`
  property: `[{ "field": ..., "message": ... }]`, both for `@Valid` request
  bodies and for constrained `@RequestParam`/`@PathVariable` parameters.
  Do not put `@Validated` on controllers: Spring MVC validates parameters
  natively, and `@Validated` switches to the AOP path (`ConstraintViolationException`),
  which the handler treats as a 500. 500 responses never contain exception
  messages or stack traces.
- **Time:** inject `java.time.Clock` (bean in `ClockConfig`) instead of calling
  `LocalDate.now()` directly, so date rules are testable with `Clock.fixed`.
- **Configuration:** `application.yml` with env-var overrides
  (`${ENV_VAR:default}`), bound to `@ConfigurationProperties` records under the
  `routewise.*` prefix. The app must start with zero configuration.
- **Persistence:** schema only via Flyway (see the `add-flyway-migration` skill);
  `ddl-auto=validate`, `open-in-view=false`. Never edit an existing migration.
  Services map entities to DTOs inside their transaction; repositories use
  `@EntityGraph` for associations the response needs (no lazy loading outside).
  Exception: services that call external APIs (e.g. `ComparisonService`) are
  not transactional; they load what they need via `@EntityGraph` queries and
  map detached entities.
  H2 is pinned to 2.3.232 in `pom.xml` (see the comment there) — keep the pin
  until a fixed H2 release is verified with the `TripRepositoryTest` suite.
- **External HTTP:** use `RestClient` built from the injected
  `RestClient.Builder` (from `spring-boot-starter-restclient`), with explicit
  connect and read timeouts from configuration (see `WeatherClientConfig`).
  Exception: Claude is called through the official Anthropic Java SDK
  (`AnthropicOkHttpClient`, timeout and retries from `AdvisorProperties`).
  Each client sits behind an interface in the feature's `client/` package
  so it can be mocked and swapped. Clients throw on failure; the feature's
  service catches and degrades (e.g. `WeatherService` returns no forecast,
  `AdvisorService` falls back to its rules). `ClaudeAdvisorClient` wraps SDK
  errors in `AdvisorClientException`. Never let an external outage fail a request.
  Don't hold a database transaction open across external calls.
- **LLM output is untrusted input:** validate it like a request (see
  `TripDraftResolver`) and never let it override computed results
  (the comparison engine picks the recommended mode).
- **Pure business rules** (e.g. `ComparisonEngine`, `GeoDistance`,
  `ItineraryCalculator`) take plain records as input (`ComparisonInput`,
  `ModeParameters`, `Leg`), not entities, and do no I/O.
- **Trips and stops:** `Trip` is the aggregate root of its `TripStop`s (2–10,
  `TripStops.MIN`/`MAX`); change them only through `Trip.replaceStops`, which
  reuses rows by position so the unique (trip, position) constraint holds.
  Stop lists from requests (trips and `POST /api/comparisons`) go through
  `StopResolver`, which reports every bad stop as `stops[i].cityId`.
  Comparisons run the engine once per leg (stop *i* to *i+1*, that leg's
  weather), then `ItineraryCalculator` builds the mixed plan and single-mode totals.
- **CORS:** handled centrally in `CorsConfig` for `/api/**`; origins come from
  `routewise.cors.allowed-origins` (env `ROUTEWISE_CORS_ALLOWED_ORIGINS`).
  Credentials are allowed, so origins must stay explicit (never `*`).
- **Security:** session login (`JSESSIONID`) via the JSON endpoints in
  `AuthController`; no form login or HTTP Basic. Access rules live only in
  `SecurityConfig`: reference data, `POST /api/comparisons` and the auth
  endpoints are public, the rest of `/api/**` needs a login. New public
  endpoints must be added there explicitly. Controllers get the user with
  `@AuthenticationPrincipal AuthUser` and pass `user.id()` to services;
  user-owned data is always queried by id *and* owner (`...ByIdAndOwnerId`),
  so someone else's record is a 404. CSRF uses the cookie pattern
  (`XSRF-TOKEN` → `X-XSRF-TOKEN`); `CsrfCookieFilter` makes sure the cookie
  is sent. 401/403 from the filter chain go through `GlobalExceptionHandler`
  as Problem Details. Never log or return passwords or hashes (DTOs and
  `AuthUser` override `toString`).
- New endpoints: follow the `add-rest-endpoint` skill.

## Testing

- JUnit 5, AssertJ, Mockito, MockMvc (`spring-boot-starter-*-test` modules).
- Services: plain unit tests with Mockito, no Spring context.
- Controllers: `@WebMvcTest(XController.class)` with `@MockitoBean` services
  and `@Import(SecurityConfig.class)`, MockMvc from `TestUsers.mockMvcAsAlice`
  (or `anonymousMockMvc`); cover success, 400 (validation) and 404, and 401
  for endpoints that need a login.
- `@SpringBootTest` tests send CSRF with `TestUsers.csrfCookie` /
  `TestUsers.withCsrf`, never Spring Security's `csrf()` post-processor: it
  swaps the token repository in the cached context for good, and later tests
  in that context get no `XSRF-TOKEN` cookie.
- The Claude client is tested against a local `HttpServer` faking `/v1/messages`
  (`ClaudeAdvisorClientTest`): request shape, success, refusal, server error;
  its timeout in `AdvisorClientConfigTest`.
- HTTP clients: `MockRestServiceServer.bindTo(RestClient.builder())`; cover
  success, missing data, server error and timeout. Test that configured
  timeouts are applied against a local `com.sun.net.httpserver.HttpServer`
  (see `WeatherClientConfigTest`). Never call real services in tests.
- Scoring/rule tests assert hand-computed literal values (document the
  calculation in the test), not values derived from the code under test.
- Repositories: `@DataJpaTest` only for custom queries; Flyway runs, so tests
  validate the real schema.
- `RoutewiseApiApplicationTests` (`@SpringBootTest`) must keep passing; it
  proves Flyway, Hibernate validation and OpenAPI wire up.
- Test method names: `method_condition_expectedResult` or
  `condition_expectedResult` for controller slices.
- Test-only controllers/fixtures live under `src/test`, never in `src/main`.
- Reference-data entities (`City`, `TransportMode`) have no public constructor
  or setters. Build them in unit tests with `TestCities` or
  `BeanUtils.instantiateClass` + `ReflectionTestUtils`, never by mocking entities.
