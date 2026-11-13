package com.routewise.trip.dto;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * A trip's recommended itinerary computed without weather, for all travelers.
 *
 * @param carCo2Kg        the car for the whole route; {@code null} when the car cannot do every leg
 * @param co2VsCarPercent signed change against the car (e.g. -81); {@code null} without a car figure
 * @param co2ShareOfCar   the plan's CO2 as a share of the car's, 0-1; {@code null} without a car figure
 * @param modes           distinct modes of the plan, in leg order
 * @param legModes        the recommended mode of each leg
 */
public record TripFiguresResponse(
        BigDecimal totalCost,
        BigDecimal co2Kg,
        BigDecimal carCo2Kg,
        Integer co2VsCarPercent,
        BigDecimal co2ShareOfCar,
        List<TransportModeCode> modes,
        List<TransportModeCode> legModes) {
}
