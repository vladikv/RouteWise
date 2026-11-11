package com.routewise.advisor.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.routewise.advisor.domain.TripDraft;
import com.routewise.advisor.domain.TripExtraction;
import com.routewise.city.dto.CitySummary;
import com.routewise.trip.domain.TripPriority;

import org.springframework.stereotype.Component;

/**
 * Checks an extraction (from the LLM or the rules) against the trip rules, so a
 * draft never contains values the trip form would reject. Unusable values are
 * dropped with a warning. Holds no state and does no I/O.
 */
@Component
public class TripDraftResolver {

    static final int MIN_TRAVELERS = 1;
    static final int MAX_TRAVELERS = 9;
    static final int MAX_TITLE_LENGTH = 100;
    static final int MAX_NOTES_LENGTH = 1000;

    /**
     * @param cities supported cities; names are matched case-insensitively
     * @param today  departure dates before this day are dropped
     */
    public TripDraft resolve(TripExtraction extraction, List<CitySummary> cities, LocalDate today) {
        List<String> warnings = new ArrayList<>();
        CitySummary origin = resolveCity(extraction.originCity(), "origin", cities, warnings);
        CitySummary destination = resolveCity(extraction.destinationCity(), "destination", cities, warnings);
        if (origin != null && origin.equals(destination)) {
            warnings.add("Origin and destination are the same city; please choose a different destination.");
            destination = null;
        }
        return new TripDraft(
                title(extraction.title(), origin, destination),
                origin,
                destination,
                resolveDate(extraction.departureDate(), today, warnings),
                resolveTravelers(extraction.travelers(), warnings),
                extraction.priority() != null ? extraction.priority() : TripPriority.BALANCED,
                truncate(extraction.notes(), MAX_NOTES_LENGTH),
                List.copyOf(warnings));
    }

    private static CitySummary resolveCity(String name, String role, List<CitySummary> cities, List<String> warnings) {
        if (name == null) {
            warnings.add("No %s city recognised.".formatted(role));
            return null;
        }
        Optional<CitySummary> city = cities.stream().filter(c -> c.name().equalsIgnoreCase(name)).findFirst();
        if (city.isEmpty()) {
            warnings.add("\"%s\" is not a supported %s city.".formatted(name, role));
        }
        return city.orElse(null);
    }

    private static LocalDate resolveDate(LocalDate date, LocalDate today, List<String> warnings) {
        if (date == null) {
            warnings.add("No departure date recognised.");
            return null;
        }
        if (date.isBefore(today)) {
            warnings.add("Departure date %s is in the past.".formatted(date));
            return null;
        }
        return date;
    }

    /** Defaults to one traveler when the request does not say. */
    private static int resolveTravelers(Integer travelers, List<String> warnings) {
        if (travelers == null) {
            return MIN_TRAVELERS;
        }
        if (travelers < MIN_TRAVELERS || travelers > MAX_TRAVELERS) {
            warnings.add("Travelers must be between %d and %d; the request mentions %d."
                    .formatted(MIN_TRAVELERS, MAX_TRAVELERS, travelers));
            return MIN_TRAVELERS;
        }
        return travelers;
    }

    private static String title(String title, CitySummary origin, CitySummary destination) {
        if (title != null) {
            return truncate(title, MAX_TITLE_LENGTH);
        }
        if (origin != null && destination != null) {
            return "%s to %s".formatted(origin.name(), destination.name());
        }
        if (destination != null) {
            return "Trip to " + destination.name();
        }
        return "New trip";
    }

    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
