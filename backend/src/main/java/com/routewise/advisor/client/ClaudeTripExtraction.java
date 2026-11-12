package com.routewise.advisor.client;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import com.routewise.trip.domain.TripPriority;

/**
 * Structured output schema for trip extraction. Structured outputs require every
 * field, so "unknown" is an empty string, an empty list or 0 instead of {@code null}.
 */
record ClaudeTripExtraction(
        @JsonPropertyDescription("Short trip title, at most 60 characters, e.g. \"Weekend in Vienna\"")
        String title,
        @JsonPropertyDescription("Every stop in travel order, starting with the departure city. Use the name from "
                + "the supported city list; write an unsupported city exactly as stated. \"Back home\" or "
                + "\"and back\" means the trip ends at the first stop again. Empty if no city is stated")
        List<String> stops,
        @JsonPropertyDescription("Departure date (the first day of travel) as YYYY-MM-DD; empty if not stated")
        String departureDate,
        @JsonPropertyDescription("True if the request mentions further dates after the departure, such as a "
                + "return day")
        boolean laterDates,
        @JsonPropertyDescription("Number of travelers including the requester; 0 if not stated")
        int travelers,
        @JsonPropertyDescription("What the traveler optimizes for; BALANCED if not stated or mixed")
        TripPriority priority,
        @JsonPropertyDescription("Other relevant wishes from the request in one sentence; empty if none")
        String notes) {
}
