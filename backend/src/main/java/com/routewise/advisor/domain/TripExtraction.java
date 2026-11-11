package com.routewise.advisor.domain;

import java.time.LocalDate;

import com.routewise.trip.domain.TripPriority;

/**
 * Trip fields as read from free text, before they are checked against
 * reference data. Every field is {@code null} when the text does not mention it.
 *
 * @param originCity      city name as written; resolved against the seeded cities later
 * @param destinationCity city name as written
 */
public record TripExtraction(
        String title,
        String originCity,
        String destinationCity,
        LocalDate departureDate,
        Integer travelers,
        TripPriority priority,
        String notes) {

    public static TripExtraction empty() {
        return new TripExtraction(null, null, null, null, null, null, null);
    }
}
