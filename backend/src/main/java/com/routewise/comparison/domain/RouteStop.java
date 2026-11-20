package com.routewise.comparison.domain;

import com.routewise.city.dto.CitySummary;

/**
 * A stop as the route planner needs it: the city reference for the response, its
 * coordinates for the distance, its landmass for the ground-mode rule and its airport for the plane.
 *
 * @param airportCode IATA code; {@code null} when the city has no working airport
 */
public record RouteStop(CitySummary city, double latitude, double longitude, String landmass, String airportCode) {

    /** Whether the plane can be offered to and from this stop. */
    public boolean hasAirport() {
        return airportCode != null;
    }
}
