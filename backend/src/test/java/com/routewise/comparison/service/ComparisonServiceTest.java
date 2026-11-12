package com.routewise.comparison.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
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
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import com.routewise.city.TestCities;
import com.routewise.city.domain.City;
import com.routewise.city.repository.CityRepository;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.common.exception.ValidationError;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.dto.ComparisonRequest;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.LegResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.ModeTotalsResponse;
import com.routewise.comparison.mapper.ComparisonMapper;
import com.routewise.transportmode.domain.TransportMode;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.transportmode.repository.TransportModeRepository;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.dto.TripStopRequest;
import com.routewise.trip.repository.TripRepository;
import com.routewise.trip.service.StopResolver;
import com.routewise.user.TestUsers;
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
    /** Open-Meteo code 73: moderate snow. */
    private static final int SNOW = 73;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private CityRepository cityRepository;

    @Mock
    private TransportModeRepository transportModeRepository;

    @Mock
    private WeatherService weatherService;

    private ComparisonService comparisonService;

    private final City berlin = TestCities.berlin();
    private final City vienna = TestCities.vienna();
    private final City prague = TestCities.prague();

    @BeforeEach
    void setUp() {
        comparisonService = new ComparisonService(tripRepository, new StopResolver(cityRepository),
                transportModeRepository, weatherService, new ComparisonEngine(), new ItineraryCalculator(),
                new ComparisonMapper(), CLOCK);
    }

    @Test
    void compare_threeStops_returnsTwoLegsWithOneRecommendationEach() {
        when(tripRepository.findWithStopsByIdAndOwnerId(1L, TestUsers.ALICE_ID))
                .thenReturn(Optional.of(trip(berlin, prague, vienna)));
        when(transportModeRepository.findAll()).thenReturn(seededModes());
        when(weatherService.forecasts(anyList(), eq(DEPARTURE))).thenReturn(List.of());

        ComparisonResponse response = comparisonService.compare(1L, TestUsers.ALICE_ID);

        assertThat(response.tripId()).isEqualTo(1L);
        assertThat(response.currency()).isEqualTo("EUR");
        assertThat(response.legs()).extracting(leg -> leg.from().name() + "-" + leg.to().name())
                .containsExactly("Berlin-Prague", "Prague-Vienna");
        assertThat(response.legs()).extracting(LegResponse::index).containsExactly(0, 1);
        response.legs().forEach(leg -> {
            assertThat(leg.options()).hasSize(5);
            assertThat(leg.options()).filteredOn(ModeOptionResponse::recommended).singleElement()
                    .extracting(ModeOptionResponse::mode).isEqualTo(leg.recommendedMode());
        });
        // Haversine Berlin-Prague ~280 km + Prague-Vienna ~252 km.
        assertThat(response.distanceKm()).isBetween(new BigDecimal("525"), new BigDecimal("540"));
        assertThat(response.distanceKm()).isEqualByComparingTo(
                response.legs().get(0).distanceKm().add(response.legs().get(1).distanceKm()));
    }

    @Test
    void compare_itineraryTotalsAreTheSumOfEachLegsRecommendation() {
        when(tripRepository.findWithStopsByIdAndOwnerId(1L, TestUsers.ALICE_ID))
                .thenReturn(Optional.of(trip(berlin, prague, vienna)));
        when(transportModeRepository.findAll()).thenReturn(seededModes());
        when(weatherService.forecasts(anyList(), eq(DEPARTURE))).thenReturn(List.of());

        ComparisonResponse response = comparisonService.compare(1L, TestUsers.ALICE_ID);

        List<ModeOptionResponse> chosen = response.legs().stream()
                .map(leg -> leg.options().stream().filter(ModeOptionResponse::recommended).findFirst().orElseThrow())
                .toList();
        assertThat(response.recommendedItinerary().modes())
                .containsExactlyElementsOf(chosen.stream().map(ModeOptionResponse::mode).toList());
        assertThat(response.recommendedItinerary().durationMinutes())
                .isEqualTo(chosen.stream().mapToInt(ModeOptionResponse::durationMinutes).sum());
        assertThat(response.recommendedItinerary().totalCost()).isEqualByComparingTo(
                chosen.stream().map(ModeOptionResponse::totalCost).reduce(BigDecimal.ZERO, BigDecimal::add));
        assertThat(response.singleModeTotals()).extracting(ModeTotalsResponse::mode)
                .containsExactly(TransportModeCode.values());
        assertThat(response.singleModeTotals()).filteredOn(totals -> totals.mode() == TransportModeCode.BIKE)
                .singleElement().satisfies(bike -> {
                    assertThat(bike.available()).isFalse();
                    assertThat(bike.unavailableReason()).startsWith("Leg 1 (Berlin to Prague): ");
                    assertThat(bike.durationMinutes()).isNull();
                });
    }

    @Test
    void compare_appliesEachLegsOwnWeather() {
        when(tripRepository.findWithStopsByIdAndOwnerId(1L, TestUsers.ALICE_ID))
                .thenReturn(Optional.of(trip(berlin, prague, vienna)));
        when(transportModeRepository.findAll()).thenReturn(seededModes());
        LocationForecast viennaSnow = new LocationForecast(new Location("Vienna", 48.2082, 16.3738),
                new WeatherForecast(DEPARTURE, SNOW, -4.0, 1.0, 90, 20.0));
        when(weatherService.forecasts(anyList(), eq(DEPARTURE))).thenReturn(List.of(viennaSnow));

        ComparisonResponse response = comparisonService.compare(1L, TestUsers.ALICE_ID);

        assertThat(carNotes(response.legs().get(0))).isEmpty();
        assertThat(carNotes(response.legs().get(1))).anySatisfy(note -> assertThat(note).contains("Vienna"));
        assertThat(response.weather()).extracting(summary -> summary.city()).containsExactly("Vienna");
    }

    @Test
    @SuppressWarnings("unchecked")
    void compare_roundTrip_requestsWeatherOncePerCityOnTheDepartureDate() {
        when(tripRepository.findWithStopsByIdAndOwnerId(1L, TestUsers.ALICE_ID))
                .thenReturn(Optional.of(trip(berlin, vienna, berlin)));
        when(transportModeRepository.findAll()).thenReturn(seededModes());
        when(weatherService.forecasts(anyList(), any())).thenReturn(List.of());

        ComparisonResponse response = comparisonService.compare(1L, TestUsers.ALICE_ID);

        ArgumentCaptor<List<Location>> locations = ArgumentCaptor.forClass(List.class);
        verify(weatherService).forecasts(locations.capture(), eq(DEPARTURE));
        assertThat(locations.getValue()).extracting(Location::name).containsExactly("Berlin", "Vienna");
        assertThat(response.legs()).hasSize(2);
    }

    @Test
    void compare_whenTripMissing_throwsNotFoundWithoutCallingWeather() {
        when(tripRepository.findWithStopsByIdAndOwnerId(42L, TestUsers.ALICE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> comparisonService.compare(42L, TestUsers.ALICE_ID))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Trip with id 42 not found");
        verifyNoInteractions(weatherService);
    }

    @Test
    void preview_twoStops_comparesWithoutATrip() {
        knownCities(berlin, vienna);
        when(transportModeRepository.findAll()).thenReturn(seededModes());
        when(weatherService.forecasts(anyList(), eq(DEPARTURE))).thenReturn(List.of());

        ComparisonResponse response = comparisonService.preview(request(DEPARTURE, 1L, 2L));

        assertThat(response.tripId()).isNull();
        assertThat(response.departureDate()).isEqualTo(DEPARTURE);
        assertThat(response.travelers()).isEqualTo(3);
        assertThat(response.priority()).isEqualTo(TripPriority.CHEAPEST);
        assertThat(response.distanceKm()).isBetween(new BigDecimal("522"), new BigDecimal("526"));
        assertThat(response.legs()).singleElement().satisfies(leg -> assertThat(leg.options()).hasSize(5));
        assertThat(response.recommendedItinerary().modes()).hasSize(1);
        verifyNoInteractions(tripRepository);
    }

    @Test
    void preview_todayAsDepartureDate_isAllowed() {
        LocalDate today = LocalDate.of(2026, 11, 11);
        knownCities(berlin, vienna);
        when(transportModeRepository.findAll()).thenReturn(seededModes());
        when(weatherService.forecasts(anyList(), eq(today))).thenReturn(List.of());

        assertThat(comparisonService.preview(request(today, 1L, 2L)).departureDate()).isEqualTo(today);
    }

    @Test
    void preview_sameCityTwiceInARow_throwsFieldErrorWithoutCallingWeather() {
        knownCities(berlin);

        assertThatThrownBy(() -> comparisonService.preview(request(DEPARTURE, 1L, 1L)))
                .isInstanceOf(FieldValidationException.class)
                .extracting(ex -> ((FieldValidationException) ex).getErrors())
                .isEqualTo(List.of(new ValidationError("stops[1].cityId", "must differ from the previous stop")));
        verifyNoInteractions(weatherService);
    }

    @Test
    void preview_pastDepartureDate_throwsFieldError() {
        assertThatThrownBy(() -> comparisonService.preview(request(LocalDate.of(2026, 11, 10), 1L, 2L)))
                .isInstanceOf(FieldValidationException.class)
                .hasMessage("departureDate must be today or later");
        verifyNoInteractions(weatherService);
    }

    @Test
    void preview_unknownCity_throwsFieldErrorWithoutCallingWeather() {
        knownCities(berlin);

        assertThatThrownBy(() -> comparisonService.preview(request(DEPARTURE, 1L, 99L)))
                .isInstanceOf(FieldValidationException.class)
                .hasMessage("stops[1].cityId unknown city id 99");
        verifyNoInteractions(weatherService);
    }

    private static List<String> carNotes(LegResponse leg) {
        return leg.options().stream().filter(o -> o.mode() == TransportModeCode.CAR).findFirst().orElseThrow()
                .notes();
    }

    private void knownCities(City... cities) {
        when(cityRepository.findAllById(anyIterable())).thenReturn(Arrays.asList(cities));
    }

    private static ComparisonRequest request(LocalDate date, Long... cityIds) {
        return new ComparisonRequest(Arrays.stream(cityIds).map(TripStopRequest::new).toList(), date, 3,
                TripPriority.CHEAPEST);
    }

    private static Trip trip(City... stops) {
        Trip trip = new Trip();
        trip.setId(1L);
        trip.setTitle("Test trip");
        trip.replaceStops(List.of(stops));
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
