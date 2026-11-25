package com.routewise.comparison.dto;

/**
 * The hub where a plane option changes planes.
 *
 * @param cityId      id of the hub city
 * @param cityName    name of the hub city, e.g. "Hong Kong"
 * @param airportCode the hub's IATA code
 */
public record ConnectionResponse(Long cityId, String cityName, String airportCode) {
}
