package com.routewise.comparison.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.routewise.city.dto.CitySummary;
import com.routewise.comparison.domain.ItineraryTotals;
import com.routewise.comparison.domain.Leg;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeTotals;
import com.routewise.comparison.domain.RoutePlan;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.comparison.domain.UnavailableGroup;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.LegResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.ModeTotalsResponse;
import com.routewise.comparison.dto.UnavailableGroupResponse;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.Location;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.domain.WeatherForecast;
import com.routewise.weather.domain.WeatherHazard;
import com.routewise.weather.domain.WeatherReport;
import com.routewise.weather.domain.WeatherStatus;

import org.junit.jupiter.api.Test;

class ComparisonMapperTest {

    private static final LocalDate DEPARTURE = LocalDate.of(2026, 11, 20);
    private static final CitySummary BERLIN = new CitySummary(1L, "Berlin", "DE");
    private static final CitySummary VIENNA = new CitySummary(2L, "Vienna", "AT");

    private final ComparisonMapper mapper = new ComparisonMapper();

    private static final ModeOption TRAIN = new ModeOption(TransportModeCode.TRAIN, true, null, null, 628.25, 373,
            new BigDecimal("150.78"), new BigDecimal("44.0"), 87, true, List.of("note"));

    @Test
    void toResponse_mapsLegsWeatherTotalsAndRoundsDistances() {
        LocationForecast vienna = new LocationForecast(new Location("Vienna", 48.2, 16.37),
                new WeatherForecast(DEPARTURE, 61, 2.0, 8.0, 80, 15.0));
        Leg there = new Leg(BERLIN, VIENNA, 523.549, List.of(TRAIN));
        Leg back = new Leg(VIENNA, BERLIN, 523.549, List.of(TRAIN));
        ItineraryTotals plan = new ItineraryTotals(List.of(TransportModeCode.TRAIN, TransportModeCode.TRAIN), 746,
                new BigDecimal("301.56"), new BigDecimal("88.0"));

        UnavailableGroup landmass = new UnavailableGroup(UnavailableCode.DIFFERENT_LANDMASS,
                List.of(TransportModeCode.BIKE),
                "Not possible for the whole trip: bike (no land route between Berlin and Vienna)");
        RoutePlan routePlan = new RoutePlan(List.of(there, back), plan,
                List.of(new ModeTotals(TransportModeCode.TRAIN, plan, null, null),
                        new ModeTotals(TransportModeCode.BIKE, null, UnavailableCode.DIFFERENT_LANDMASS,
                                "Leg 1 (Berlin to Vienna): too far")),
                List.of(List.of(), List.of()), List.of(landmass));

        ComparisonResponse response = mapper.toResponse(1L, DEPARTURE, 3, TripPriority.FASTEST,
                new WeatherReport(WeatherStatus.PARTIAL, List.of(vienna)), routePlan);

        assertThat(response.tripId()).isEqualTo(1L);
        assertThat(response.departureDate()).isEqualTo(DEPARTURE);
        assertThat(response.travelers()).isEqualTo(3);
        assertThat(response.priority()).isEqualTo(TripPriority.FASTEST);
        assertThat(response.currency()).isEqualTo("EUR");
        assertThat(response.weatherStatus()).isEqualTo(WeatherStatus.PARTIAL);
        // 523.549 + 523.549 = 1047.098
        assertThat(response.distanceKm()).isEqualByComparingTo("1047.1");
        assertThat(response.weather()).singleElement().satisfies(weather -> {
            assertThat(weather.city()).isEqualTo("Vienna");
            assertThat(weather.description()).isEqualTo("Rain");
            assertThat(weather.precipitationProbabilityPercent()).isEqualTo(80);
            assertThat(weather.hazards()).containsExactly(WeatherHazard.RAIN);
        });
        assertThat(response.legs()).extracting(LegResponse::index).containsExactly(0, 1);
        LegResponse first = response.legs().getFirst();
        assertThat(first.from()).isEqualTo(BERLIN);
        assertThat(first.to()).isEqualTo(VIENNA);
        assertThat(first.distanceKm()).isEqualByComparingTo("523.5");
        assertThat(first.recommendedMode()).isEqualTo(TransportModeCode.TRAIN);
        ModeOptionResponse option = first.options().getFirst();
        assertThat(option.distanceKm()).isEqualByComparingTo("628.3");
        assertThat(option.totalCost()).isEqualByComparingTo("150.78");
        assertThat(option.recommended()).isTrue();
        assertThat(option.notes()).containsExactly("note");
        assertThat(response.recommendedItinerary().durationMinutes()).isEqualTo(746);
        assertThat(response.singleModeTotals()).containsExactly(
                new ModeTotalsResponse(TransportModeCode.TRAIN, true, null, null, 746, new BigDecimal("301.56"),
                        new BigDecimal("88.0")),
                new ModeTotalsResponse(TransportModeCode.BIKE, false, UnavailableCode.DIFFERENT_LANDMASS,
                        "Leg 1 (Berlin to Vienna): too far", null, null, null));
        assertThat(response.unavailableGroups()).containsExactly(new UnavailableGroupResponse(
                UnavailableCode.DIFFERENT_LANDMASS, List.of(TransportModeCode.BIKE),
                "Not possible for the whole trip: bike (no land route between Berlin and Vienna)"));
        assertThat(first.unavailableGroups()).isEmpty();
    }

    @Test
    void toResponse_withoutAPlan_hasNullItineraryAndLegWithoutRecommendation() {
        ModeOption bike = new ModeOption(TransportModeCode.BIKE, false, UnavailableCode.TOO_FAR, "too far", 680, null, null, null, 0, false,
                List.of());

        UnavailableGroup tooFar = new UnavailableGroup(UnavailableCode.TOO_FAR, List.of(TransportModeCode.BIKE),
                "Too far between Berlin and Vienna for: bike");
        RoutePlan routePlan = new RoutePlan(List.of(new Leg(BERLIN, VIENNA, 523.5, List.of(bike))), null, List.of(),
                List.of(List.of(tooFar)), List.of());

        ComparisonResponse response = mapper.toResponse(null, DEPARTURE, 1, TripPriority.BALANCED,
                new WeatherReport(WeatherStatus.OUT_OF_RANGE, List.of()), routePlan);

        assertThat(response.tripId()).isNull();
        assertThat(response.recommendedItinerary()).isNull();
        assertThat(response.legs().getFirst().recommendedMode()).isNull();
        assertThat(response.legs().getFirst().options().getFirst().unavailableCode())
                .isEqualTo(UnavailableCode.TOO_FAR);
        assertThat(response.legs().getFirst().unavailableGroups()).extracting(UnavailableGroupResponse::message)
                .containsExactly("Too far between Berlin and Vienna for: bike");
    }
}
