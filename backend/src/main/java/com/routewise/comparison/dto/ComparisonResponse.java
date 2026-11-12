package com.routewise.comparison.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.routewise.trip.domain.TripPriority;

/**
 * Per-leg comparison of a route with two or more stops.
 *
 * @param tripId               {@code null} for a route that is not a stored trip
 * @param distanceKm           straight-line distance summed over all legs
 * @param weather              forecast per stop city (each city once), empty if unavailable
 * @param recommendedItinerary each leg's recommended mode combined; {@code null} if a leg has no available mode
 * @param singleModeTotals     one entry per mode, used for every leg, for comparison with the mixed plan
 */
public record ComparisonResponse(
        Long tripId,
        LocalDate departureDate,
        int travelers,
        TripPriority priority,
        BigDecimal distanceKm,
        String currency,
        List<WeatherSummary> weather,
        List<LegResponse> legs,
        ItineraryTotalsResponse recommendedItinerary,
        List<ModeTotalsResponse> singleModeTotals) {
}
