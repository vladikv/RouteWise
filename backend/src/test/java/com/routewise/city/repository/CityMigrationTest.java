package com.routewise.city.repository;

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
 * V6 to V8 add city geography, the worldwide seed and the plane CO2 factors. Runs Flyway directly on its own
 * in-memory database and checks the seeded rows with plain SQL.
 */
class CityMigrationTest {

    /** The V2 cities in insert order, so ids 1 to 25. */
    private static final List<String> V2_CITIES = List.of(
            "Amsterdam", "Barcelona", "Berlin", "Brussels", "Budapest", "Cologne", "Copenhagen", "Frankfurt",
            "Hamburg", "Krakow", "Lisbon", "Ljubljana", "London", "Lyon", "Madrid", "Milan", "Munich", "Paris",
            "Prague", "Rome", "Stockholm", "Venice", "Vienna", "Warsaw", "Zurich");

    private String url;

    @BeforeEach
    void setUp() {
        url = "jdbc:h2:mem:cities-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration").load().migrate();
    }

    @Test
    void migrate_seedsTheV2AndV7Cities() throws SQLException {
        // 25 from V2 + 125 from V7
        assertThat(count("SELECT COUNT(*) FROM city")).isEqualTo(150);
        assertThat(count("SELECT COUNT(DISTINCT name) FROM city")).isEqualTo(150);
    }

    @Test
    void migrate_v2CitiesKeepTheirIdsAndNames() throws SQLException {
        List<String> firstTwentyFive = column("SELECT name FROM city WHERE id <= 25 ORDER BY id");

        assertThat(firstTwentyFive).containsExactlyElementsOf(V2_CITIES);
        assertThat(column("SELECT name FROM city WHERE id = 13")).containsExactly("London");
        assertThat(column("SELECT name FROM city WHERE id = 18")).containsExactly("Paris");
    }

    @Test
    void migrate_v2CitiesStayEuropeanOnTheEurasianLandmass() throws SQLException {
        assertThat(count("SELECT COUNT(*) FROM city WHERE id <= 25 AND continent = 'EUROPE' "
                + "AND landmass = 'EURASIA'")).isEqualTo(25);
    }

    @Test
    void migrate_allCoordinatesAreValid() throws SQLException {
        assertThat(count("SELECT COUNT(*) FROM city WHERE latitude < -90 OR latitude > 90 "
                + "OR longitude < -180 OR longitude > 180")).isZero();
    }

    @Test
    void migrate_everyCityHasContinentLandmassAndLabelRankOneToThree() throws SQLException {
        assertThat(count("SELECT COUNT(*) FROM city WHERE continent IS NULL OR TRIM(continent) = '' "
                + "OR landmass IS NULL OR TRIM(landmass) = ''")).isZero();
        assertThat(count("SELECT COUNT(*) FROM city WHERE label_rank NOT BETWEEN 1 AND 3")).isZero();
    }

    @Test
    void migrate_everyCapitalHasLabelRankOneOrTwo() throws SQLException {
        assertThat(count("SELECT COUNT(*) FROM city WHERE capital = TRUE")).isPositive();
        assertThat(count("SELECT COUNT(*) FROM city WHERE capital = TRUE AND label_rank > 2")).isZero();
    }

    @Test
    void migrate_fixedLinksPutLondonParisCopenhagenAndStockholmOnTheEurasianLandmass() throws SQLException {
        // London-Paris: Channel Tunnel; Copenhagen: Oresund and Great Belt bridges to the mainland.
        assertThat(column("SELECT landmass FROM city WHERE name IN ('London', 'Paris', 'Copenhagen', 'Stockholm')"))
                .containsOnly("EURASIA").hasSize(4);
    }

    @Test
    void migrate_dublinIsOnItsOwnIrelandLandmass() throws SQLException {
        assertThat(column("SELECT landmass FROM city WHERE name = 'Dublin'")).containsExactly("IRELAND");
        assertThat(column("SELECT continent FROM city WHERE name = 'Dublin'")).containsExactly("EUROPE");
    }

    @Test
    void migrate_newYorkIsOnTheNorthAmericanContinent() throws SQLException {
        assertThat(column("SELECT continent FROM city WHERE name = 'New York'")).containsExactly("NORTH_AMERICA");
    }

    @Test
    void migrate_planeHasLongHaulFactorAndGlobalRange() throws SQLException {
        assertThat(column("SELECT co2_grams_per_km || '/' || long_haul_co2_grams_per_km || '/' || max_distance_km "
                + "FROM transport_mode WHERE code = 'PLANE'")).containsExactly("183/200/20100");
    }

    @Test
    void migrate_nonPlaneModesHaveNoLongHaulFactor() throws SQLException {
        assertThat(count("SELECT COUNT(*) FROM transport_mode WHERE code <> 'PLANE' "
                + "AND long_haul_co2_grams_per_km IS NOT NULL")).isZero();
        assertThat(count("SELECT COUNT(*) FROM transport_mode")).isEqualTo(5);
    }

    private int count(String sql) throws SQLException {
        return Integer.parseInt(column(sql).getFirst());
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
