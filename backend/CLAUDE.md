# RouteWise API (backend)

Spring Boot 4.1 REST API, Java 21, Maven. Read the root `CLAUDE.md` first;
this file adds backend-specific rules.

## Layout

Package-by-feature under `com.routewise`. Each feature owns its layers:

```
com.routewise
├── common/
│   ├── config/       CORS, OpenAPI, shared @ConfigurationProperties
│   └── exception/    RouteWiseException hierarchy, GlobalExceptionHandler
└── <feature>/        e.g. trip, city, comparison, advisor
    ├── controller/   @RestController, DTOs in/out only
    ├── service/      business logic, transactions
    ├── repository/   Spring Data JPA interfaces
    ├── domain/       JPA entities, enums
    ├── dto/          request/response records
    └── mapper/       entity ↔ DTO mapping
```

Resources: `application.yml`, Flyway migrations in `src/main/resources/db/migration/`.

## Commands

| Task | Command |
|---|---|
| Run | `./mvnw spring-boot:run` |
| Run on another port | `./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=8081` |
| Build + all tests | `./mvnw verify` |
| Single test class | `./mvnw test -Dtest=GlobalExceptionHandlerTest` |

Swagger UI: `/swagger-ui.html` · OpenAPI JSON: `/v3/api-docs` ·
H2 console: `/h2-console` (JDBC URL `jdbc:h2:mem:routewise`, user `sa`, empty password).

## Conventions

- **DTOs are Java records.** Request records carry Bean Validation
  annotations and are bound with `@Valid`. Entities never leave the service layer.
- **Constructor injection only.** `final` fields, no field `@Autowired`.
- **Lombok only on JPA entities** (`@Getter`, `@Setter`, `@NoArgsConstructor`).
  Never `@Data` on entities (breaks `equals`/`hashCode` with lazy relations).
  No Lombok on services, controllers, DTOs or config.
- **Errors:** throw a `RouteWiseException` subclass (e.g. `ResourceNotFoundException`).
  `GlobalExceptionHandler` turns them into RFC 7807 Problem Details
  (`application/problem+json`). Do not use `ResponseStatusException` and do not
  build error bodies in controllers. Validation errors use the `errors`
  property: `[{ "field": ..., "message": ... }]`. 500 responses never
  contain exception messages or stack traces.
- **Configuration:** `application.yml` with env-var overrides
  (`${ENV_VAR:default}`), bound to `@ConfigurationProperties` records under the
  `routewise.*` prefix. The app must start with zero configuration.
- **Persistence:** schema only via Flyway (see the `add-flyway-migration` skill);
  `ddl-auto=validate`, `open-in-view=false`. Never edit an existing migration.
- **External HTTP** (weather, LLM): use `RestClient` built from the injected
  `RestClient.Builder`, with explicit connect and read timeouts from
  configuration. Each client sits behind an interface in the feature package
  so it can be mocked and swapped.
- **CORS:** handled centrally in `CorsConfig` for `/api/**`; origins come from
  `routewise.cors.allowed-origins` (env `ROUTEWISE_CORS_ALLOWED_ORIGINS`).
- New endpoints: follow the `add-rest-endpoint` skill.

## Testing

- JUnit 5, AssertJ, Mockito, MockMvc (`spring-boot-starter-*-test` modules).
- Services: plain unit tests with Mockito, no Spring context.
- Controllers: `@WebMvcTest(XController.class)` with `@MockitoBean` services;
  cover success, 400 (validation) and 404.
- Repositories: `@DataJpaTest` only for custom queries; Flyway runs, so tests
  validate the real schema.
- `RoutewiseApiApplicationTests` (`@SpringBootTest`) must keep passing; it
  proves Flyway, Hibernate validation and OpenAPI wire up.
- Test method names: `method_condition_expectedResult` or
  `condition_expectedResult` for controller slices.
- Test-only controllers/fixtures live under `src/test`, never in `src/main`.
