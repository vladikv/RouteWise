package com.routewise.city.dto;

import com.routewise.city.domain.Continent;

/**
 * @param landmass    ground-connected region; ground modes only run within one
 * @param labelRank   map label priority, 1 (shown first) to 3 (only when zoomed in)
 * @param airportCode IATA code of the airport that serves the city; {@code null} when it has no working airport
 */
public record CityResponse(Long id, String name, String country, double latitude, double longitude,
                           Continent continent, String landmass, boolean capital, int labelRank,
                           String airportCode) {
}
