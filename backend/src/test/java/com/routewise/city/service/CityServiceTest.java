package com.routewise.city.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.util.List;

import com.routewise.city.TestCities;
import com.routewise.city.dto.CityResponse;
import com.routewise.city.mapper.CityMapper;
import com.routewise.city.repository.CityRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CityServiceTest {

    @Mock
    private CityRepository cityRepository;

    private CityService cityService;

    @BeforeEach
    void setUp() {
        cityService = new CityService(cityRepository, new CityMapper());
    }

    @Test
    void findAll_withoutQuery_returnsAllCities() {
        when(cityRepository.findAllByOrderByNameAsc()).thenReturn(List.of(TestCities.berlin(), TestCities.vienna()));

        List<CityResponse> cities = cityService.findAll(null);

        assertThat(cities).extracting(CityResponse::name).containsExactly("Berlin", "Vienna");
        assertThat(cities.getFirst().latitude()).isEqualTo(52.52);
    }

    @Test
    void findAll_withBlankQuery_returnsAllCities() {
        when(cityRepository.findAllByOrderByNameAsc()).thenReturn(List.of());

        cityService.findAll("   ");

        verify(cityRepository).findAllByOrderByNameAsc();
        verifyNoMoreInteractions(cityRepository);
    }

    @Test
    void findAll_withQuery_searchesByStrippedName() {
        when(cityRepository.findByNameContainingIgnoreCaseOrderByNameAsc("vie"))
                .thenReturn(List.of(TestCities.vienna()));

        assertThat(cityService.findAll("  vie ")).extracting(CityResponse::name).containsExactly("Vienna");
    }
}
