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
 *
 * @param stops at least two entries in travel order; an entry is {@code null}
 *              where the stop is unknown or not a supported city
 */
public record TripDraftResponse(
        String title,
        List<CitySummary> stops,
        LocalDate departureDate,
        int travelers,
        TripPriority priority,
        String notes,
        AdvisorSource source,
        List<String> warnings) {
}
