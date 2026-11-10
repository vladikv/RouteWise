---
name: add-rest-endpoint
description: Step-by-step workflow for adding a new REST endpoint to the RouteWise backend, from DTO to test. Use whenever a new API operation is needed.
---

# Add a REST endpoint

1. **Design the contract first.** Write down: HTTP method, path, request
   DTO, response DTO, success status, error cases. Use plural nouns
   (`/api/trips/{id}`), no verbs in paths.
2. **DTOs** in `dto/` as Java records. Request DTOs carry Bean
   Validation annotations; response DTOs never expose entities.
3. **Mapper**: add mapping methods in the feature's mapper class.
4. **Service**: implement the logic in the service layer. Throw
   domain exceptions (e.g. `TripNotFoundException`), never
   `ResponseStatusException`.
5. **Controller**: thin method that delegates to the service.
  - `POST` → `201 Created` + `Location` header
  - `DELETE` → `204 No Content`
  - Add `@Operation` summary for Swagger.
6. **Errors**: if a new exception type was added, map it in
   `GlobalExceptionHandler` to a Problem Detail with the correct status.
7. **Tests**: service unit test + `@WebMvcTest` covering success,
   validation failure (400) and not found (404).
8. Run `./mvnw verify`, then ask the `backend-reviewer` agent to review.
