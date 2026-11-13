package com.routewise.comparison.domain;

import com.routewise.city.dto.CitySummary;

/**
 * A stop as the route planner needs it: the city reference for the response, its
 * coordinates for the distance and its landmass for the ground-mode rule.
 */
public record RouteStop(CitySummary city, double latitude, double longitude, String landmass) {
}
