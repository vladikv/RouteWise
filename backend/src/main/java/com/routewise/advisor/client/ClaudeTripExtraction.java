package com.routewise.advisor.client;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import com.routewise.trip.domain.TripPriority;

/**
 * Structured output schema for trip extraction. Structured outputs require every
 * field, so "unknown" is an empty string or 0 instead of {@code null}.
 */
record ClaudeTripExtraction(
        @JsonPropertyDescription("Short trip title, at most 60 characters, e.g. \"Weekend in Vienna\"")
        String title,
        @JsonPropertyDescription("Origin city, exactly as in the supported city list; empty if not stated or not supported")
        String originCity,
        @JsonPropertyDescription("Destination city, exactly as in the supported city list; empty if not stated or not supported")
        String destinationCity,
        @JsonPropertyDescription("Departure date as YYYY-MM-DD; empty if not stated")
        String departureDate,
        @JsonPropertyDescription("Number of travelers including the requester; 0 if not stated")
        int travelers,
        @JsonPropertyDescription("What the traveler optimizes for; BALANCED if not stated or mixed")
        TripPriority priority,
        @JsonPropertyDescription("Other relevant wishes from the request in one sentence; empty if none")
        String notes) {
}
