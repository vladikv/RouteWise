package com.routewise.trip.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.routewise.trip.domain.TripPriority;

/**
 * A trip in the list: the fields of {@link TripResponse} plus its figures.
 *
 * @param figures {@code null} when some leg has no available mode
 */
public record TripListItemResponse(
        Long id,
        String title,
        List<TripStopResponse> stops,
        LocalDate departureDate,
        int travelers,
        TripPriority priority,
        String notes,
        Instant createdAt,
        Instant updatedAt,
        TripFiguresResponse figures) {
}
