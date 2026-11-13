package com.routewise.comparison.domain;

import java.util.List;

/**
 * The computed comparison of a route: every leg's options, the recommended mixed itinerary,
 * the single-mode totals and the grouped reasons why modes are unavailable.
 *
 * @param recommendedItinerary {@code null} when some leg has no available mode
 * @param legUnavailable       one list per leg (same order as {@code legs}), empty when every mode is available
 * @param totalsUnavailable    why single modes cannot be used for the whole route
 */
public record RoutePlan(
        List<Leg> legs,
        ItineraryTotals recommendedItinerary,
        List<ModeTotals> singleModeTotals,
        List<List<UnavailableGroup>> legUnavailable,
        List<UnavailableGroup> totalsUnavailable) {
}
