package com.routewise.comparison.domain;

import java.math.BigDecimal;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Engine input for one transport mode; decoupled from the JPA entity so the
 * engine stays a pure function. Cost and CO2 are per traveler, except CAR (per vehicle).
 */
public record ModeParameters(
        TransportModeCode code,
        int avgSpeedKmh,
        BigDecimal costPerKm,
        int co2GramsPerKm,
        int fixedOverheadMinutes,
        int maxDistanceKm) {
}
