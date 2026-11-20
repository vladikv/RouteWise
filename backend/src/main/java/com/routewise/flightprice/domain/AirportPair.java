package com.routewise.flightprice.domain;

import java.util.Objects;

/**
 * A one-way flight route between two airports.
 *
 * @param fromAirport IATA code of the departure airport
 * @param toAirport   IATA code of the arrival airport
 */
public record AirportPair(String fromAirport, String toAirport) {

    public AirportPair {
        Objects.requireNonNull(fromAirport, "fromAirport");
        Objects.requireNonNull(toAirport, "toAirport");
    }

    /** Two cities served by the same airport (e.g. Amsterdam and Utrecht) have no flight between them. */
    public boolean isSameAirport() {
        return fromAirport.equals(toAirport);
    }
}
