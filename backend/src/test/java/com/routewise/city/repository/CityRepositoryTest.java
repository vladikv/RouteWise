package com.routewise.city.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.routewise.city.domain.City;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

/**
 * Runs against the real Flyway schema and seed data (ddl-auto=validate).
 */
@DataJpaTest
class CityRepositoryTest {

    @Autowired
    private CityRepository cityRepository;

    @Test
    void findByHubTrueOrderByNameAsc_returnsTheSeededHubsByName() {
        assertThat(cityRepository.findByHubTrueOrderByNameAsc())
                .extracting(City::getName)
                .hasSize(20)
                .startsWith("Addis Ababa", "Amsterdam", "Atlanta")
                .contains("Dubai", "Singapore", "São Paulo")
                .isSorted();
    }

    @Test
    void findByHubTrueOrderByNameAsc_everyHubHasAnAirport() {
        assertThat(cityRepository.findByHubTrueOrderByNameAsc())
                .allSatisfy(city -> assertThat(city.getAirportCode()).isNotNull());
    }
}
