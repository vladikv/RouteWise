package com.routewise.trip.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.routewise.trip.domain.TripPriority;

/** A trip with its ordered stops (at least two). */
public record TripResponse(
        Long id,
        String title,
        List<TripStopResponse> stops,
        LocalDate departureDate,
        int travelers,
        TripPriority priority,
        String notes,
        Instant createdAt,
        Instant updatedAt) {
}
