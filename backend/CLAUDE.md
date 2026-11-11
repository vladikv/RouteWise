# RouteWise API (backend)

Spring Boot 4.1 REST API, Java 21, Maven. Read the root `CLAUDE.md` first;
this file adds backend-specific rules.

## Layout

Package-by-feature under `com.routewise`. Each feature owns its layers:

```
com.routewise
├── common/
│   ├── config/       cross-cutting config: CORS, OpenAPI, Clock
│   └── exception/    RouteWiseException hierarchy, GlobalExceptionHandler
└── <feature>/        e.g. trip, city, comparison, weather, advisor
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
  specific field, e.g. an unknown city id).
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
- **Pure business rules** (e.g. `ComparisonEngine`, `GeoDistance`) take plain
  records as input (`ComparisonInput`, `ModeParameters`), not entities, and do no I/O.
- **CORS:** handled centrally in `CorsConfig` for `/api/**`; origins come from
  `routewise.cors.allowed-origins` (env `ROUTEWISE_CORS_ALLOWED_ORIGINS`).
- New endpoints: follow the `add-rest-endpoint` skill.

## Testing

- JUnit 5, AssertJ, Mockito, MockMvc (`spring-boot-starter-*-test` modules).
- Services: plain unit tests with Mockito, no Spring context.
- Controllers: `@WebMvcTest(XController.class)` with `@MockitoBean` services;
  cover success, 400 (validation) and 404.
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
