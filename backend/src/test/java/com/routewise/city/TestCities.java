package com.routewise.city;

import com.routewise.city.domain.City;

import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Builds {@link City} instances for unit tests. Cities are seeded reference
 * data without public constructors or setters, so tests populate them by reflection.
 */
public final class TestCities {

    private TestCities() {
    }

    public static City city(Long id, String name, String country, double latitude, double longitude) {
        City city = BeanUtils.instantiateClass(City.class);
        ReflectionTestUtils.setField(city, "id", id);
        ReflectionTestUtils.setField(city, "name", name);
        ReflectionTestUtils.setField(city, "country", country);
        ReflectionTestUtils.setField(city, "latitude", latitude);
        ReflectionTestUtils.setField(city, "longitude", longitude);
        return city;
    }

    public static City berlin() {
        return city(1L, "Berlin", "DE", 52.52, 13.405);
    }

    public static City vienna() {
        return city(2L, "Vienna", "AT", 48.2082, 16.3738);
    }
}
