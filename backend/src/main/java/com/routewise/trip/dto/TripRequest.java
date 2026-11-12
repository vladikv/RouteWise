package com.routewise.trip.dto;

import java.time.LocalDate;
import java.util.List;

import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.domain.TripStops;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/trips} and {@code PUT /api/trips/{id}}. {@code stops}
 * replaces the whole ordered stop list. Rules that depend on stored state (existing
 * cities, no two consecutive stops in the same city, departure date not in the past
 * unless unchanged on update) are checked in {@code TripService}.
 */
public record TripRequest(
        @NotBlank @Size(max = 100) String title,
        @NotNull @Size(min = TripStops.MIN, max = TripStops.MAX) List<@NotNull @Valid TripStopRequest> stops,
        @NotNull LocalDate departureDate,
        @NotNull @Min(1) @Max(9) Integer travelers,
        @NotNull TripPriority priority,
        @Size(max = 1000) String notes) {
}
