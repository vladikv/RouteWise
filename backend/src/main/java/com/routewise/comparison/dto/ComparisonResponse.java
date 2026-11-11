package com.routewise.comparison.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.routewise.trip.domain.TripPriority;

/**
 * Mode comparison for a trip.
 *
 * @param distanceKm straight-line distance between the cities
 * @param weather    forecasts used for scoring; empty when none is available
 * @param options    available modes by score (best first), then unavailable ones;
 *                   at most one is {@code recommended} (none if no mode is available)
 */
public record ComparisonResponse(
        Long tripId,
        LocalDate departureDate,
        int travelers,
        TripPriority priority,
        BigDecimal distanceKm,
        String currency,
        List<WeatherSummary> weather,
        List<ModeOptionResponse> options) {
}
