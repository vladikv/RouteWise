package com.routewise.trip.domain;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * What the trip list and stats show for one trip: its recommended itinerary computed without
 * weather. Cost and CO2 are for all travelers.
 *
 * @param carCo2Kg        the car for the whole route; {@code null} when the car cannot do every leg
 * @param co2VsCarPercent signed change against the car, e.g. -81 for 61 kg against 323 kg; {@code null} without a car
 * @param co2ShareOfCar   the plan's CO2 as a share of the car's, 0-1 (capped at 1); {@code null} without a car
 * @param modes           distinct modes of the plan, in leg order
 * @param legModes        the recommended mode of every leg, in leg order
 */
public record TripFigures(
        BigDecimal totalCost,
        BigDecimal co2Kg,
        BigDecimal carCo2Kg,
        Integer co2VsCarPercent,
        BigDecimal co2ShareOfCar,
        List<TransportModeCode> modes,
        List<TransportModeCode> legModes) {

    public boolean hasCar() {
        return carCo2Kg != null;
    }
}
