package com.routewise.advisor.domain;

import java.time.LocalDate;
import java.util.List;

import com.routewise.trip.domain.TripPriority;

/**
 * Trip fields as read from free text, before they are checked against
 * reference data. Fields are {@code null} (or empty) when the text does not mention them.
 *
 * @param stops       city names in travel order, as written; resolved against the seeded cities later.
 *                    Names of unsupported cities are kept so they can be reported.
 * @param laterDates  the text mentions dates after the departure (e.g. a return day); they are not stored
 */
public record TripExtraction(
        String title,
        List<String> stops,
        LocalDate departureDate,
        boolean laterDates,
        Integer travelers,
        TripPriority priority,
        String notes) {

    public static TripExtraction empty() {
        return new TripExtraction(null, List.of(), null, false, null, null, null);
    }
}
