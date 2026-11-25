package com.routewise.comparison.domain;

import com.routewise.city.dto.CitySummary;

/**
 * A flight with one connection: from the leg's first city to the hub, then on to the second city.
 *
 * @param hub         the city where travellers change planes
 * @param airportCode the hub's IATA code
 * @param firstKm     great-circle distance from the leg's first city to the hub
 * @param secondKm    great-circle distance from the hub to the leg's second city
 */
public record FlightConnection(CitySummary hub, String airportCode, double firstKm, double secondKm) {

    public double totalKm() {
        return firstKm + secondKm;
    }

    /** The longer of the two flights; it must be within the plane's range. */
    public double longestKm() {
        return Math.max(firstKm, secondKm);
    }
}
