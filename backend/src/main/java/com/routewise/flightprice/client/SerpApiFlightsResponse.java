package com.routewise.flightprice.client;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Subset of a SerpApi Google Flights answer: the price of every offered itinerary, or an error.
 * Google Flights lists the best options in {@code best_flights} and the rest in {@code other_flights}.
 */
record SerpApiFlightsResponse(
        @JsonProperty("best_flights") List<Itinerary> bestFlights,
        @JsonProperty("other_flights") List<Itinerary> otherFlights,
        String error) {

    /** @param price total for the requested adults, in the requested currency; may be missing */
    record Itinerary(Integer price) {
    }
}
