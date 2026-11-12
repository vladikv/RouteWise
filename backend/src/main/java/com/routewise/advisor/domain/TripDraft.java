package com.routewise.advisor.domain;

import java.time.LocalDate;
import java.util.List;

import com.routewise.city.dto.CitySummary;
import com.routewise.trip.domain.TripPriority;

/**
 * A checked trip draft: known stops are seeded cities, the date is not in the past
 * and travelers are in range. {@code stops} has at least two entries, in travel
 * order; an entry is {@code null} where a stop could not be determined (explained
 * in {@code warnings}), so the form shows an empty stop to fill in.
 */
public record TripDraft(
        String title,
        List<CitySummary> stops,
        LocalDate departureDate,
        int travelers,
        TripPriority priority,
        String notes,
        List<String> warnings) {
}
