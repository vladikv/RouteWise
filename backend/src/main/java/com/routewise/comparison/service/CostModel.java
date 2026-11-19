package com.routewise.comparison.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;

import com.routewise.comparison.domain.ModeParameters;
import com.routewise.pricing.domain.Fare;
import com.routewise.pricing.domain.LegPricing;
import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Pure cost rules for one mode on one leg, in EUR rounded to cents. The results are estimates:
 * <ul>
 *   <li>CAR: {@code cars × routeKm × (6.5 l/100 km × fuel price + toll per km)}; the car's {@code costPerKm}
 *       is then not used</li>
 *   <li>TRAIN, BUS, PLANE: {@code travelers × (base fare + price per km × routeKm)}</li>
 *   <li>without a regional price (and always for BIKE): {@code units × routeKm × the mode's costPerKm},
 *       the same arithmetic as before regional prices existed</li>
 * </ul>
 */
final class CostModel {

    /** Average consumption of a petrol car: 6.5 l/100 km. */
    static final BigDecimal CAR_LITRES_PER_KM = new BigDecimal("0.065");

    private CostModel() {
    }

    /**
     * @param units cars for CAR, travelers for every other mode
     */
    static BigDecimal cost(ModeParameters mode, double routeKm, int units, LegPricing pricing) {
        BigDecimal km = BigDecimal.valueOf(routeKm);
        BigDecimal count = BigDecimal.valueOf(units);
        if (mode.code() == TransportModeCode.CAR && pricing.fuelEurPerLitre() != null) {
            BigDecimal perKm = CAR_LITRES_PER_KM.multiply(pricing.fuelEurPerLitre()).add(pricing.tollEurPerKm());
            return cents(perKm.multiply(km).multiply(count));
        }
        Optional<Fare> fare = pricing.fare(mode.code());
        if (fare.isPresent()) {
            return cents(fare.get().baseFareEur().add(fare.get().costPerKm().multiply(km)).multiply(count));
        }
        return cents(mode.costPerKm().multiply(BigDecimal.valueOf(routeKm * units)));
    }

    private static BigDecimal cents(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
