package com.routewise.advisor.dto;

import java.time.LocalDate;
import java.util.List;

import com.routewise.advisor.domain.AdvisorSource;
import com.routewise.city.dto.CitySummary;
import com.routewise.trip.domain.TripPriority;

/**
 * A trip draft to prefill the trip form; not stored. Values that could not be
 * determined are {@code null} and explained in {@code warnings}. Travelers
 * default to 1 and priority to BALANCED when the text does not mention them.
 */
public record TripDraftResponse(
        String title,
        CitySummary origin,
        CitySummary destination,
        LocalDate departureDate,
        int travelers,
        TripPriority priority,
        String notes,
        AdvisorSource source,
        List<String> warnings) {
}
