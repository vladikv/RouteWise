package com.routewise.comparison.service;

import com.routewise.comparison.domain.ModeParameters;

/**
 * Pure rule: the CO2 factor for a leg. A mode with a long-haul factor (PLANE) uses it when the
 * great-circle distance is above {@link #LONG_HAUL_THRESHOLD_KM}; at or below the threshold,
 * and for every other mode, the regular (short-haul) factor applies.
 */
public final class FlightEmissions {

    /** DEFRA's boundary between short-haul and long-haul flights (great-circle distance). */
    public static final double LONG_HAUL_THRESHOLD_KM = 3700;

    private FlightEmissions() {
    }

    public static int co2GramsPerKm(ModeParameters mode, double greatCircleKm) {
        Integer longHaul = mode.longHaulCo2GramsPerKm();
        return longHaul != null && greatCircleKm > LONG_HAUL_THRESHOLD_KM ? longHaul : mode.co2GramsPerKm();
    }
}
