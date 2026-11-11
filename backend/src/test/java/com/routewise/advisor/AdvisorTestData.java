package com.routewise.advisor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.WeatherSummary;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.WeatherHazard;

/**
 * Hand-written comparison fixtures for advisor tests (values are illustrative,
 * not computed by the engine).
 */
public final class AdvisorTestData {

    /** Wednesday. */
    public static final LocalDate TODAY = LocalDate.of(2026, 11, 11);
    public static final LocalDate DEPARTURE = LocalDate.of(2026, 11, 20);

    private AdvisorTestData() {
    }

    public static ModeOptionResponse train(boolean recommended) {
        return new ModeOptionResponse(TransportModeCode.TRAIN, true, null, new BigDecimal("628.3"), 373,
                new BigDecimal("150.80"), new BigDecimal("44.0"), 87, recommended, List.of());
    }

    public static ModeOptionResponse bus() {
        return new ModeOptionResponse(TransportModeCode.BUS, true, null, new BigDecimal("680.7"), 453,
                new BigDecimal("90.80"), new BigDecimal("54.0"), 71, false, List.of());
    }

    public static ModeOptionResponse bikeUnavailable() {
        return new ModeOptionResponse(TransportModeCode.BIKE, false,
                "Route of 681 km exceeds the BIKE limit of 150 km", new BigDecimal("680.7"),
                null, null, null, 0, false, List.of());
    }

    public static WeatherSummary rainInVienna() {
        return new WeatherSummary("Vienna", DEPARTURE, "Rain", 4.0, 9.0, 90, 20.0, Set.of(WeatherHazard.RAIN));
    }

    public static ComparisonResponse comparison(List<WeatherSummary> weather, ModeOptionResponse... options) {
        return new ComparisonResponse(1L, DEPARTURE, 2, TripPriority.GREENEST, new BigDecimal("523.6"), "EUR",
                weather, List.of(options));
    }

    /** Train recommended, bus as alternative, bike unavailable, rain in Vienna. */
    public static ComparisonResponse berlinToVienna() {
        return comparison(List.of(rainInVienna()), train(true), bus(), bikeUnavailable());
    }
}
