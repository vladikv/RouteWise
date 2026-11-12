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
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.LegResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.ModeTotalsResponse;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.Location;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.domain.WeatherForecast;
import com.routewise.weather.domain.WeatherHazard;

import org.junit.jupiter.api.Test;

class ComparisonMapperTest {

    private static final LocalDate DEPARTURE = LocalDate.of(2026, 11, 20);
    private static final CitySummary BERLIN = new CitySummary(1L, "Berlin", "DE");
    private static final CitySummary VIENNA = new CitySummary(2L, "Vienna", "AT");

    private final ComparisonMapper mapper = new ComparisonMapper();

    private static final ModeOption TRAIN = new ModeOption(TransportModeCode.TRAIN, true, null, 628.25, 373,
            new BigDecimal("150.78"), new BigDecimal("44.0"), 87, true, List.of("note"));

    @Test
    void toResponse_mapsLegsWeatherTotalsAndRoundsDistances() {
        LocationForecast vienna = new LocationForecast(new Location("Vienna", 48.2, 16.37),
                new WeatherForecast(DEPARTURE, 61, 2.0, 8.0, 80, 15.0));
        Leg there = new Leg(BERLIN, VIENNA, 523.549, List.of(TRAIN));
        Leg back = new Leg(VIENNA, BERLIN, 523.549, List.of(TRAIN));
        ItineraryTotals plan = new ItineraryTotals(List.of(TransportModeCode.TRAIN, TransportModeCode.TRAIN), 746,
                new BigDecimal("301.56"), new BigDecimal("88.0"));

        ComparisonResponse response = mapper.toResponse(1L, DEPARTURE, 3, TripPriority.FASTEST, List.of(vienna),
                List.of(there, back), plan, List.of(new ModeTotals(TransportModeCode.TRAIN, plan, null),
                        new ModeTotals(TransportModeCode.BIKE, null, "Leg 1 (Berlin to Vienna): too far")));

        assertThat(response.tripId()).isEqualTo(1L);
        assertThat(response.departureDate()).isEqualTo(DEPARTURE);
        assertThat(response.travelers()).isEqualTo(3);
        assertThat(response.priority()).isEqualTo(TripPriority.FASTEST);
        assertThat(response.currency()).isEqualTo("EUR");
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
                new ModeTotalsResponse(TransportModeCode.TRAIN, true, null, 746, new BigDecimal("301.56"),
                        new BigDecimal("88.0")),
                new ModeTotalsResponse(TransportModeCode.BIKE, false, "Leg 1 (Berlin to Vienna): too far", null,
                        null, null));
    }

    @Test
    void toResponse_withoutAPlan_hasNullItineraryAndLegWithoutRecommendation() {
        ModeOption bike = new ModeOption(TransportModeCode.BIKE, false, "too far", 680, null, null, null, 0, false,
                List.of());

        ComparisonResponse response = mapper.toResponse(null, DEPARTURE, 1, TripPriority.BALANCED, List.of(),
                List.of(new Leg(BERLIN, VIENNA, 523.5, List.of(bike))), null, List.of());

        assertThat(response.tripId()).isNull();
        assertThat(response.recommendedItinerary()).isNull();
        assertThat(response.legs().getFirst().recommendedMode()).isNull();
    }
}
