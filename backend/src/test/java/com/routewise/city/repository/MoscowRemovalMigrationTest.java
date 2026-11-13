package com.routewise.city.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * V10 removes Moscow. Migrates to V9, stores trips that do and do not visit Moscow,
 * then migrates to the latest version on its own in-memory database.
 */
class MoscowRemovalMigrationTest {

    private String url;

    @BeforeEach
    void setUp() {
        url = "jdbc:h2:mem:moscow-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
    }

    @Test
    void moscowAndTripsVisitingIt_areRemoved_otherTripsAndCitiesStay() throws SQLException {
        flyway("9").migrate();
        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement()) {
            assertThat(count(statement, "SELECT COUNT(*) FROM city WHERE name = 'Moscow'")).isEqualTo(1);
            statement.execute("""
                    INSERT INTO app_user (id, email, password_hash, display_name, created_at)
                    VALUES (1, 'alice@example.com', 'hash', 'Alice', CURRENT_TIMESTAMP)""");
            insertTrip(statement, 10, "Berlin", "Moscow");
            insertTrip(statement, 11, "Warsaw", "Moscow", "Berlin");
            insertTrip(statement, 12, "Berlin", "Vienna");
        }

        flyway(null).migrate();

        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement()) {
            assertThat(count(statement, "SELECT COUNT(*) FROM city WHERE name = 'Moscow'")).isZero();
            assertThat(count(statement, "SELECT COUNT(*) FROM city")).isEqualTo(149);
            assertThat(count(statement, "SELECT COUNT(*) FROM trip WHERE id IN (10, 11)")).isZero();
            assertThat(count(statement, "SELECT COUNT(*) FROM trip_stop WHERE trip_id IN (10, 11)")).isZero();
            assertThat(count(statement, "SELECT COUNT(*) FROM trip WHERE id = 12")).isEqualTo(1);
            assertThat(count(statement, "SELECT COUNT(*) FROM trip_stop WHERE trip_id = 12")).isEqualTo(2);
        }
    }

    private Flyway flyway(String target) {
        var configuration = Flyway.configure()
                .dataSource(url, "sa", "")
                .locations("classpath:db/migration");
        if (target != null) {
            configuration.target(target);
        }
        return configuration.load();
    }

    private static void insertTrip(Statement statement, int id, String... cities) throws SQLException {
        statement.execute("""
                INSERT INTO trip (id, title, departure_date, travelers, priority, created_at, updated_at, owner_id)
                VALUES (%d, 'Trip %d', DATE '2026-12-01', 1, 'BALANCED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)"""
                .formatted(id, id));
        for (int position = 0; position < cities.length; position++) {
            statement.execute("""
                    INSERT INTO trip_stop (trip_id, city_id, stop_position)
                    VALUES (%d, (SELECT id FROM city WHERE name = '%s'), %d)"""
                    .formatted(id, cities[position], position));
        }
    }

    private static int count(Statement statement, String sql) throws SQLException {
        try (ResultSet rows = statement.executeQuery(sql)) {
            rows.next();
            return rows.getInt(1);
        }
    }
}
