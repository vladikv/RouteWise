package com.routewise.comparison.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import com.routewise.city.TestCities;
import com.routewise.city.repository.CityRepository;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.dto.ComparisonRequest;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.mapper.ComparisonMapper;
import com.routewise.transportmode.domain.TransportMode;
import com.routewise.transportmode.repository.TransportModeRepository;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.repository.TripRepository;
import com.routewise.weather.domain.Location;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.domain.WeatherForecast;
import com.routewise.weather.service.WeatherService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ComparisonServiceTest {

    private static final LocalDate DEPARTURE = LocalDate.of(2026, 11, 20);
    /** Today is 2026-11-11. */
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-11T10:00:00Z"), ZoneOffset.UTC);

    @Mock
    private TripRepository tripRepository;

    @Mock
    private CityRepository cityRepository;

    @Mock
    private TransportModeRepository transportModeRepository;

    @Mock
    private WeatherService weatherService;

    private ComparisonService comparisonService;

    @BeforeEach
    void setUp() {
        comparisonService = new ComparisonService(tripRepository, cityRepository, transportModeRepository,
                weatherService, new ComparisonEngine(), new ComparisonMapper(), CLOCK);
    }

    @Test
    void compare_berlinToVienna_returnsAllModesWithWeatherAndOneRecommendation() {
        when(tripRepository.findWithCitiesById(1L)).thenReturn(Optional.of(trip()));
        when(transportModeRepository.findAll()).thenReturn(seededModes());
        LocationForecast viennaRain = new LocationForecast(new Location("Vienna", 48.2082, 16.3738),
                new WeatherForecast(DEPARTURE, 63, 4.0, 9.0, 90, 20.0));
        when(weatherService.forecasts(anyList(), eq(DEPARTURE))).thenReturn(List.of(viennaRain));

        ComparisonResponse response = comparisonService.compare(1L);

        assertThat(response.tripId()).isEqualTo(1L);
        assertThat(response.distanceKm()).isBetween(new BigDecimal("522"), new BigDecimal("526"));
        assertThat(response.currency()).isEqualTo("EUR");
        assertThat(response.weather()).singleElement().satisfies(weather -> {
            assertThat(weather.city()).isEqualTo("Vienna");
            assertThat(weather.description()).isEqualTo("Rain");
        });
        assertThat(response.options()).hasSize(5);
        assertThat(response.options()).filteredOn(ModeOptionResponse::recommended).hasSize(1);
        assertThat(response.options().getLast().mode().name()).isEqualTo("BIKE");
        assertThat(response.options().getLast().available()).isFalse();
    }

    @Test
    @SuppressWarnings("unchecked")
    void compare_requestsWeatherForOriginAndDestinationOnDepartureDate() {
        when(tripRepository.findWithCitiesById(1L)).thenReturn(Optional.of(trip()));
        when(transportModeRepository.findAll()).thenReturn(seededModes());
        when(weatherService.forecasts(anyList(), any())).thenReturn(List.of());

        comparisonService.compare(1L);

        ArgumentCaptor<List<Location>> locations = ArgumentCaptor.forClass(List.class);
        verify(weatherService).forecasts(locations.capture(), eq(DEPARTURE));
        assertThat(locations.getValue()).extracting(Location::name).containsExactly("Berlin", "Vienna");
    }

    @Test
    void compare_whenTripMissing_throwsNotFoundWithoutCallingWeather() {
        when(tripRepository.findWithCitiesById(42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> comparisonService.compare(42L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Trip with id 42 not found");
        verifyNoInteractions(weatherService);
    }

    @Test
    void preview_berlinToVienna_comparesWithoutATrip() {
        when(cityRepository.findById(1L)).thenReturn(Optional.of(TestCities.berlin()));
        when(cityRepository.findById(2L)).thenReturn(Optional.of(TestCities.vienna()));
        when(transportModeRepository.findAll()).thenReturn(seededModes());
        when(weatherService.forecasts(anyList(), eq(DEPARTURE))).thenReturn(List.of());

        ComparisonResponse response = comparisonService.preview(
                new ComparisonRequest(1L, 2L, DEPARTURE, 3, TripPriority.CHEAPEST));

        assertThat(response.tripId()).isNull();
        assertThat(response.departureDate()).isEqualTo(DEPARTURE);
        assertThat(response.travelers()).isEqualTo(3);
        assertThat(response.priority()).isEqualTo(TripPriority.CHEAPEST);
        assertThat(response.distanceKm()).isBetween(new BigDecimal("522"), new BigDecimal("526"));
        assertThat(response.options()).hasSize(5);
        assertThat(response.options()).filteredOn(ModeOptionResponse::recommended).hasSize(1);
        verifyNoInteractions(tripRepository);
    }

    @Test
    void preview_todayAsDepartureDate_isAllowed() {
        LocalDate today = LocalDate.of(2026, 11, 11);
        when(cityRepository.findById(1L)).thenReturn(Optional.of(TestCities.berlin()));
        when(cityRepository.findById(2L)).thenReturn(Optional.of(TestCities.vienna()));
        when(transportModeRepository.findAll()).thenReturn(seededModes());
        when(weatherService.forecasts(anyList(), eq(today))).thenReturn(List.of());

        assertThat(comparisonService.preview(new ComparisonRequest(1L, 2L, today, 1, TripPriority.BALANCED))
                .departureDate()).isEqualTo(today);
    }

    @Test
    void preview_sameOriginAndDestination_throwsFieldError() {
        assertThatThrownBy(() -> comparisonService.preview(
                new ComparisonRequest(1L, 1L, DEPARTURE, 1, TripPriority.BALANCED)))
                .isInstanceOf(FieldValidationException.class)
                .hasMessage("destinationCityId must differ from originCityId");
        verifyNoInteractions(cityRepository, weatherService);
    }

    @Test
    void preview_pastDepartureDate_throwsFieldError() {
        assertThatThrownBy(() -> comparisonService.preview(
                new ComparisonRequest(1L, 2L, LocalDate.of(2026, 11, 10), 1, TripPriority.BALANCED)))
                .isInstanceOf(FieldValidationException.class)
                .hasMessage("departureDate must be today or later");
        verifyNoInteractions(weatherService);
    }

    @Test
    void preview_unknownCity_throwsFieldErrorWithoutCallingWeather() {
        when(cityRepository.findById(1L)).thenReturn(Optional.of(TestCities.berlin()));
        when(cityRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> comparisonService.preview(
                new ComparisonRequest(1L, 99L, DEPARTURE, 1, TripPriority.BALANCED)))
                .isInstanceOf(FieldValidationException.class)
                .hasMessage("destinationCityId unknown city id 99");
        verifyNoInteractions(weatherService);
    }

    private static Trip trip() {
        Trip trip = new Trip();
        trip.setId(1L);
        trip.setTitle("Weekend in Vienna");
        trip.setOrigin(TestCities.berlin());
        trip.setDestination(TestCities.vienna());
        trip.setDepartureDate(DEPARTURE);
        trip.setTravelers(2);
        trip.setPriority(TripPriority.BALANCED);
        return trip;
    }

    private static List<TransportMode> seededModes() {
        return ComparisonEngineTest.SEEDED_MODES.stream().map(ComparisonServiceTest::entity).toList();
    }

    private static TransportMode entity(ModeParameters parameters) {
        TransportMode mode = BeanUtils.instantiateClass(TransportMode.class);
        ReflectionTestUtils.setField(mode, "code", parameters.code());
        ReflectionTestUtils.setField(mode, "avgSpeedKmh", parameters.avgSpeedKmh());
        ReflectionTestUtils.setField(mode, "costPerKm", parameters.costPerKm());
        ReflectionTestUtils.setField(mode, "co2GramsPerKm", parameters.co2GramsPerKm());
        ReflectionTestUtils.setField(mode, "fixedOverheadMinutes", parameters.fixedOverheadMinutes());
        ReflectionTestUtils.setField(mode, "maxDistanceKm", parameters.maxDistanceKm());
        return mode;
    }
}
