package com.routewise.comparison.dto;

import java.time.LocalDate;
import java.util.List;

import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.domain.TripStops;
import com.routewise.trip.dto.TripStopRequest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/comparisons}: a route to compare without storing a trip.
 * Same field rules as a trip. Rules that need stored state or the clock (existing
 * cities, no two consecutive stops in the same city, date not in the past) are
 * checked in {@code ComparisonService}.
 */
public record ComparisonRequest(
        @NotNull @Size(min = TripStops.MIN, max = TripStops.MAX) List<@NotNull @Valid TripStopRequest> stops,
        @NotNull LocalDate departureDate,
        @NotNull @Min(1) @Max(9) Integer travelers,
        @NotNull TripPriority priority) {
}
