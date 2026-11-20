package com.routewise.comparison.domain;

import java.util.Map;
import java.util.Optional;

import com.routewise.flightprice.domain.AirportPair;
import com.routewise.flightprice.domain.LiveFare;

/**
 * Live flight fares of a route, looked up before planning so the planner stays free of I/O.
 */
public record PlaneFares(Map<AirportPair, LiveFare> byRoute) {

    /** No live fares: every plane cost is the estimate (trip list, stats, no API key). */
    public static final PlaneFares NONE = new PlaneFares(Map.of());

    public PlaneFares {
        byRoute = Map.copyOf(byRoute);
    }

    /** Empty when either airport is missing or no fare was found for that pair. */
    public Optional<LiveFare> find(String fromAirport, String toAirport) {
        if (fromAirport == null || toAirport == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(byRoute.get(new AirportPair(fromAirport, toAirport)));
    }
}
