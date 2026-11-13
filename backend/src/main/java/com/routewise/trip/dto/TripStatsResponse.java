package com.routewise.trip.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Key figures over all active trips of the user (list filters do not apply).
 *
 * @param co2SavedVsCarKg sum of max(0, car - plan) over the trips with a car figure
 * @param co2TripsCounted trips behind {@code co2SavedVsCarKg}
 * @param tripsLeftOut    trips not in the CO2 figure (no car alternative or no available plan)
 * @param averageCost     mean recommended cost of the trips with figures; {@code null} if there are none
 * @param nextTrip        the earliest trip departing today or later; {@code null} if there is none
 */
public record TripStatsResponse(
        int tripsPlanned,
        BigDecimal co2SavedVsCarKg,
        int co2TripsCounted,
        int tripsLeftOut,
        BigDecimal averageCost,
        String currency,
        NextTrip nextTrip) {

    public record NextTrip(Long id, String title, LocalDate departureDate) {
    }
}
