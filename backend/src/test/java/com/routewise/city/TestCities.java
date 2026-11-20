package com.routewise.city;

import com.routewise.city.domain.City;
import com.routewise.city.domain.Continent;

import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Builds {@link City} instances for unit tests. Cities are seeded reference
 * data without public constructors or setters, so tests populate them by reflection.
 */
public final class TestCities {

    public static final String EURASIA = "EURASIA";

    private TestCities() {
    }

    /** A non-capital European city on the Eurasian landmass with label rank 3 and an airport ("XXX"). */
    public static City city(Long id, String name, String country, double latitude, double longitude) {
        return city(id, name, country, latitude, longitude, Continent.EUROPE, EURASIA, false, 3, "XXX");
    }

    /** @param airportCode {@code null} for a city without a working airport */
    public static City city(Long id, String name, String country, double latitude, double longitude,
                            Continent continent, String landmass, boolean capital, int labelRank,
                            String airportCode) {
        City city = BeanUtils.instantiateClass(City.class);
        ReflectionTestUtils.setField(city, "id", id);
        ReflectionTestUtils.setField(city, "name", name);
        ReflectionTestUtils.setField(city, "country", country);
        ReflectionTestUtils.setField(city, "latitude", latitude);
        ReflectionTestUtils.setField(city, "longitude", longitude);
        ReflectionTestUtils.setField(city, "continent", continent);
        ReflectionTestUtils.setField(city, "landmass", landmass);
        ReflectionTestUtils.setField(city, "capital", capital);
        ReflectionTestUtils.setField(city, "labelRank", labelRank);
        ReflectionTestUtils.setField(city, "airportCode", airportCode);
        return city;
    }

    public static City berlin() {
        return city(1L, "Berlin", "DE", 52.52, 13.405, Continent.EUROPE, EURASIA, true, 1, "BER");
    }

    public static City vienna() {
        return city(2L, "Vienna", "AT", 48.2082, 16.3738, Continent.EUROPE, EURASIA, true, 2, "VIE");
    }

    public static City prague() {
        return city(3L, "Prague", "CZ", 50.0755, 14.4378, Continent.EUROPE, EURASIA, true, 2, "PRG");
    }

    /** Connected to the continent by the Channel Tunnel, so on the Eurasian landmass. */
    public static City london() {
        return city(4L, "London", "GB", 51.5074, -0.1278, Continent.EUROPE, EURASIA, true, 1, "LHR");
    }

    public static City paris() {
        return city(5L, "Paris", "FR", 48.8566, 2.3522, Continent.EUROPE, EURASIA, true, 1, "CDG");
    }

    /** On the island of Ireland: no fixed link to Great Britain. */
    public static City dublin() {
        return city(6L, "Dublin", "IE", 53.3498, -6.2603, Continent.EUROPE, "IRELAND", true, 2, "DUB");
    }

    public static City newYork() {
        return city(7L, "New York", "US", 40.7128, -74.0060, Continent.NORTH_AMERICA, "NORTH_AMERICA", false, 1, "JFK");
    }

    public static City krakow() {
        return city(9L, "Krakow", "PL", 50.0647, 19.9450, Continent.EUROPE, EURASIA, false, 2, "KRK");
    }

    /** No working airport: Ukrainian airspace is closed to civil flights. */
    public static City kharkiv() {
        return city(8L, "Kharkiv", "UA", 49.9935, 36.2304, Continent.EUROPE, EURASIA, false, 3, null);
    }
}
