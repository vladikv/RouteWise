package com.routewise.comparison.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.routewise.city.TestCities;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.Location;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.domain.WeatherForecast;
import com.routewise.weather.domain.WeatherHazard;

import org.junit.jupiter.api.Test;

class ComparisonMapperTest {

    private static final LocalDate DEPARTURE = LocalDate.of(2026, 11, 20);

    private final ComparisonMapper mapper = new ComparisonMapper();

    @Test
    void toResponse_mapsTripWeatherAndOptionsWithOneDecimalDistances() {
        LocationForecast vienna = new LocationForecast(new Location("Vienna", 48.2, 16.37),
                new WeatherForecast(DEPARTURE, 61, 2.0, 8.0, 80, 15.0));
        ModeOption train = new ModeOption(TransportModeCode.TRAIN, true, null, 628.25, 373,
                new BigDecimal("150.78"), new BigDecimal("44.0"), 87, true, List.of("note"));

        ComparisonResponse response = mapper.toResponse(trip(), 523.549, List.of(vienna), List.of(train));

        assertThat(response.tripId()).isEqualTo(1L);
        assertThat(response.departureDate()).isEqualTo(DEPARTURE);
        assertThat(response.travelers()).isEqualTo(3);
        assertThat(response.priority()).isEqualTo(TripPriority.FASTEST);
        assertThat(response.currency()).isEqualTo("EUR");
        assertThat(response.distanceKm()).isEqualByComparingTo("523.5");
        assertThat(response.weather()).singleElement().satisfies(weather -> {
            assertThat(weather.city()).isEqualTo("Vienna");
            assertThat(weather.description()).isEqualTo("Rain");
            assertThat(weather.precipitationProbabilityPercent()).isEqualTo(80);
            assertThat(weather.hazards()).containsExactly(WeatherHazard.RAIN);
        });
        ModeOptionResponse option = response.options().getFirst();
        assertThat(option.distanceKm()).isEqualByComparingTo("628.3");
        assertThat(option.totalCost()).isEqualByComparingTo("150.78");
        assertThat(option.recommended()).isTrue();
        assertThat(option.notes()).containsExactly("note");
    }

    private static Trip trip() {
        Trip trip = new Trip();
        trip.setId(1L);
        trip.setOrigin(TestCities.berlin());
        trip.setDestination(TestCities.vienna());
        trip.setDepartureDate(DEPARTURE);
        trip.setTravelers(3);
        trip.setPriority(TripPriority.FASTEST);
        return trip;
    }
}
