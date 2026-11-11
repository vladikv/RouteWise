package com.routewise.trip.dto;

import java.time.Instant;
import java.time.LocalDate;

import com.routewise.city.dto.CitySummary;
import com.routewise.trip.domain.TripPriority;

public record TripResponse(
        Long id,
        String title,
        CitySummary origin,
        CitySummary destination,
        LocalDate departureDate,
        int travelers,
        TripPriority priority,
        String notes,
        Instant createdAt,
        Instant updatedAt) {
}
