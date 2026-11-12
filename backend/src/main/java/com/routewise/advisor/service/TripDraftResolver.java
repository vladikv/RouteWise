package com.routewise.advisor.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import com.routewise.advisor.domain.TripDraft;
import com.routewise.advisor.domain.TripExtraction;
import com.routewise.city.dto.CitySummary;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.domain.TripStops;

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
        List<CitySummary> stops = resolveStops(extraction.stops(), cities, warnings);
        LocalDate departureDate = resolveDate(extraction.departureDate(), today, warnings);
        if (extraction.laterDates()) {
            warnings.add("Only the departure date is used; later dates in the request (such as a return day) "
                    + "are not stored.");
        }
        return new TripDraft(
                title(extraction.title(), stops),
                stops,
                departureDate,
                resolveTravelers(extraction.travelers(), warnings),
                extraction.priority() != null ? extraction.priority() : TripPriority.BALANCED,
                truncate(extraction.notes(), MAX_NOTES_LENGTH),
                List.copyOf(warnings));
    }

    /**
     * Maps names to seeded cities in order. Unknown names stay as an empty stop; a stop in the
     * same city as the one before it is dropped; the list is cut at the maximum and padded to
     * the minimum with empty stops, so the form always gets a usable stop list.
     */
    private static List<CitySummary> resolveStops(List<String> names, List<CitySummary> cities,
                                                  List<String> warnings) {
        List<CitySummary> stops = new ArrayList<>();
        for (String name : names == null ? List.<String>of() : names) {
            Optional<CitySummary> city = cities.stream().filter(c -> c.name().equalsIgnoreCase(name)).findFirst();
            if (city.isEmpty()) {
                warnings.add("\"%s\" is not a supported city; please choose a stop.".formatted(name));
                stops.add(null);
            } else if (!stops.isEmpty() && city.get().equals(stops.getLast())) {
                warnings.add("%s appears twice in a row; it is kept once.".formatted(city.get().name()));
            } else {
                stops.add(city.get());
            }
        }
        if (stops.size() > TripStops.MAX) {
            warnings.add("A trip has at most %d stops; the rest were left out.".formatted(TripStops.MAX));
            stops = new ArrayList<>(stops.subList(0, TripStops.MAX));
        }
        if (stops.stream().filter(Objects::nonNull).count() < TripStops.MIN && stops.size() < TripStops.MIN) {
            warnings.add(stops.isEmpty() ? "No cities recognised." : "Fewer than two stops recognised.");
        }
        while (stops.size() < TripStops.MIN) {
            stops.add(null);
        }
        return Collections.unmodifiableList(stops);
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

    /**
     * The extracted title, or one built from the stops: "Berlin to Vienna",
     * "Berlin to Vienna via Prague", "Round trip from Berlin" or "Trip to Vienna".
     */
    static String title(String title, List<CitySummary> stops) {
        if (title != null) {
            return truncate(title, MAX_TITLE_LENGTH);
        }
        CitySummary first = stops.getFirst();
        CitySummary last = stops.getLast();
        if (first != null && last != null) {
            if (first.equals(last)) {
                return truncate("Round trip from " + first.name(), MAX_TITLE_LENGTH);
            }
            List<String> via = stops.subList(1, stops.size() - 1).stream()
                    .filter(Objects::nonNull)
                    .map(CitySummary::name)
                    .toList();
            String route = "%s to %s".formatted(first.name(), last.name());
            return truncate(via.isEmpty() ? route : route + " via " + String.join(", ", via), MAX_TITLE_LENGTH);
        }
        if (last != null) {
            return "Trip to " + last.name();
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
