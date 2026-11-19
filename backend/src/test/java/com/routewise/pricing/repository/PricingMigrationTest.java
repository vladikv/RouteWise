package com.routewise.pricing.repository;

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
 * V12 and V13 add the regional prices. Runs Flyway directly on its own in-memory database and checks
 * that every seeded city can be priced.
 */
class PricingMigrationTest {

    private String url;

    @BeforeEach
    void setUp() {
        url = "jdbc:h2:mem:pricing-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration").load().migrate();
    }

    @Test
    void migrate_everyCityCountryHasAPriceRow() throws SQLException {
        assertThat(column("SELECT DISTINCT c.country FROM city c "
                + "LEFT JOIN country_pricing p ON p.country = c.country WHERE p.country IS NULL")).isEmpty();
        assertThat(column("SELECT p.country FROM country_pricing p "
                + "WHERE NOT EXISTS (SELECT 1 FROM city c WHERE c.country = p.country)")).isEmpty();
    }

    @Test
    void migrate_everyRegionHasATrainBusAndPlaneFare() throws SQLException {
        assertThat(column("SELECT p.region FROM country_pricing p GROUP BY p.region "
                + "HAVING (SELECT COUNT(*) FROM regional_fare f WHERE f.region = p.region) <> 3")).isEmpty();
        assertThat(column("SELECT f.region FROM regional_fare f "
                + "WHERE NOT EXISTS (SELECT 1 FROM country_pricing p WHERE p.region = f.region)")).isEmpty();
    }

    @Test
    void migrate_germanyAndTheUsHaveTheirSeededPrices() throws SQLException {
        assertThat(column("SELECT country || ':' || region || ':' || fuel_eur_per_litre || ':' || toll_eur_per_km "
                + "FROM country_pricing WHERE country IN ('DE', 'US') ORDER BY country"))
                .containsExactly("DE:EUROPE_WEST:1.750:0.000", "US:NORTH_AMERICA:0.800:0.010");
        assertThat(column("SELECT base_fare_eur || '+' || cost_per_km FROM regional_fare "
                + "WHERE region = 'EUROPE_WEST' AND mode_code = 'PLANE'")).containsExactly("40.00+0.070");
    }

    private List<String> column(String sql) throws SQLException {
        List<String> values = new ArrayList<>();
        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(sql)) {
            while (rows.next()) {
                values.add(rows.getString(1));
            }
        }
        return values;
    }
}
