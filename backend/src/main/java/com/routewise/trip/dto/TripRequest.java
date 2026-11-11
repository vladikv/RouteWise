package com.routewise.trip.dto;

import java.time.LocalDate;

import com.routewise.trip.domain.TripPriority;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/trips} and {@code PUT /api/trips/{id}}.
 * Rules that depend on stored state (distinct, existing cities; departure date
 * not in the past unless unchanged on update) are checked in {@code TripService}.
 */
public record TripRequest(
        @NotBlank @Size(max = 100) String title,
        @NotNull Long originCityId,
        @NotNull Long destinationCityId,
        @NotNull LocalDate departureDate,
        @NotNull @Min(1) @Max(9) Integer travelers,
        @NotNull TripPriority priority,
        @Size(max = 1000) String notes) {
}
