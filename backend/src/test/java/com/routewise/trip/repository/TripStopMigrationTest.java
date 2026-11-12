package com.routewise.trip.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * V5 turns origin/destination into stops. Runs Flyway directly on its own in-memory
 * database: migrate to V4, store trips the old way, then migrate to the latest version.
 */
class TripStopMigrationTest {

    private String url;

    @BeforeEach
    void setUp() {
        url = "jdbc:h2:mem:migration-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
    }

    @Test
    void existingTripsBecomeTwoOrderedStops_andTheOldColumnsAreGone() throws SQLException {
        flyway("4").migrate();
        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    INSERT INTO app_user (id, email, password_hash, display_name, created_at)
                    VALUES (1, 'alice@example.com', 'hash', 'Alice', CURRENT_TIMESTAMP)""");
            statement.execute(oldTrip(10, "Berlin", "Vienna"));
            statement.execute(oldTrip(11, "Paris", "Rome"));
        }

        flyway(null).migrate();

        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement()) {
            assertThat(stops(statement, 10)).containsExactly("0:Berlin", "1:Vienna");
            assertThat(stops(statement, 11)).containsExactly("0:Paris", "1:Rome");
            assertThat(columns(statement)).doesNotContain("ORIGIN_CITY_ID", "DESTINATION_CITY_ID");
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

    private static String oldTrip(int id, String origin, String destination) {
        return """
                INSERT INTO trip (id, title, origin_city_id, destination_city_id, departure_date, travelers,
                                  priority, created_at, updated_at, owner_id)
                VALUES (%d, 'Old trip', (SELECT id FROM city WHERE name = '%s'),
                        (SELECT id FROM city WHERE name = '%s'), DATE '2026-12-01', 2, 'BALANCED',
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)""".formatted(id, origin, destination);
    }

    private static List<String> stops(Statement statement, int tripId) throws SQLException {
        List<String> stops = new ArrayList<>();
        try (ResultSet rows = statement.executeQuery("""
                SELECT s.stop_position, c.name FROM trip_stop s JOIN city c ON c.id = s.city_id
                WHERE s.trip_id = %d ORDER BY s.stop_position""".formatted(tripId))) {
            while (rows.next()) {
                stops.add(rows.getInt(1) + ":" + rows.getString(2));
            }
        }
        return stops;
    }

    private static List<String> columns(Statement statement) throws SQLException {
        List<String> columns = new ArrayList<>();
        try (ResultSet rows = statement.executeQuery(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'TRIP'")) {
            while (rows.next()) {
                columns.add(rows.getString(1));
            }
        }
        return columns;
    }
}
