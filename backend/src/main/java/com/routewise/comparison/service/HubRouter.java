package com.routewise.comparison.service;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import com.routewise.comparison.domain.FlightConnection;
import com.routewise.comparison.domain.RouteStop;

/**
 * Pure rule: the connecting flight for a leg too long to fly non-stop. A leg longer than
 * {@link #NON_STOP_LIMIT_KM} is flown via the hub with the smallest total distance whose two flights
 * are both within the limit; equal totals go to the hub whose name comes first. A hub in one of the leg's
 * cities or at one of its airports is skipped. Without a fitting hub the leg stays a direct flight.
 */
public final class HubRouter {

    /**
     * The longest leg flown without a stop. Regular non-stop flights rarely go beyond it (the few
     * ultra-long-haul routes reach about 15,000 km), while e.g. Berlin to Sydney (about 16,000 km)
     * has no non-stop flight at all.
     */
    public static final double NON_STOP_LIMIT_KM = 12_000;

    private HubRouter() {
    }

    /** Empty when the leg can be flown non-stop, when a city has no airport or when no hub fits. */
    public static Optional<FlightConnection> connect(RouteStop from, RouteStop to, List<RouteStop> hubs) {
        if (!from.hasAirport() || !to.hasAirport() || distanceKm(from, to) <= NON_STOP_LIMIT_KM) {
            return Optional.empty();
        }
        return hubs.stream()
                .filter(hub -> isElsewhere(hub, from) && isElsewhere(hub, to))
                .map(hub -> new FlightConnection(hub.city(), hub.airportCode(), distanceKm(from, hub),
                        distanceKm(hub, to)))
                .filter(connection -> connection.longestKm() <= NON_STOP_LIMIT_KM)
                .min(Comparator.comparingDouble(FlightConnection::totalKm)
                        .thenComparing(connection -> connection.hub().name()));
    }

    private static boolean isElsewhere(RouteStop hub, RouteStop stop) {
        return !hub.city().id().equals(stop.city().id()) && !hub.airportCode().equals(stop.airportCode());
    }

    private static double distanceKm(RouteStop a, RouteStop b) {
        return GeoDistance.haversineKm(a.latitude(), a.longitude(), b.latitude(), b.longitude());
    }
}
