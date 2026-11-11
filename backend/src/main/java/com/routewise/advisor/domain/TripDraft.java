package com.routewise.advisor.domain;

import java.time.LocalDate;
import java.util.List;

import com.routewise.city.dto.CitySummary;
import com.routewise.trip.domain.TripPriority;

/**
 * A checked trip draft: cities are seeded cities, the date is not in the past
 * and travelers are in range. Fields that could not be determined are {@code null}
 * and explained in {@code warnings}.
 */
public record TripDraft(
        String title,
        CitySummary origin,
        CitySummary destination,
        LocalDate departureDate,
        int travelers,
        TripPriority priority,
        String notes,
        List<String> warnings) {
}
