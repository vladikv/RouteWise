package com.routewise.comparison.dto;

import java.time.LocalDate;

import com.routewise.trip.domain.TripPriority;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Body of {@code POST /api/comparisons}: a route to compare without storing a trip.
 * Same field rules as a trip. Rules that need stored state or the clock (existing,
 * distinct cities; date not in the past) are checked in {@code ComparisonService}.
 */
public record ComparisonRequest(
        @NotNull Long originCityId,
        @NotNull Long destinationCityId,
        @NotNull LocalDate departureDate,
        @NotNull @Min(1) @Max(9) Integer travelers,
        @NotNull TripPriority priority) {
}
