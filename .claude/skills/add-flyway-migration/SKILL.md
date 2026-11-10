---
name: add-flyway-migration
description: Creates a new Flyway migration for schema or seed-data changes in RouteWise. Use whenever an entity or table changes.
---

# Add a Flyway migration

Location: `backend/src/main/resources/db/migration/`

1. List existing migrations and take the next version number.
2. Name: `V<n>__<snake_case_description>.sql`,
   e.g. `V3__add_preferred_modes_to_trips.sql`.
3. **Never edit an existing migration.** Always add a new one.
   (A hook blocks edits to existing migration files.)
4. Keep schema changes and seed data in separate migrations.
5. Use explicit column types, `NOT NULL` where the domain requires it,
   and named constraints (`fk_trip_option_trip`).
6. Update the matching JPA entity, then run `./mvnw verify` to confirm
   Hibernate validation (`ddl-auto=validate`) passes.
