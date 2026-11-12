package com.routewise.trip.dto;

/**
 * One stop of a trip as the API returns it.
 *
 * @param country  ISO country code, so clients can show "Berlin (DE)" without a lookup
 * @param position 0-based order in the trip
 */
public record TripStopResponse(Long cityId, String cityName, String country, int position) {
}
