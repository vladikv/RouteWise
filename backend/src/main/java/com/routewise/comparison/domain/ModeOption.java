package com.routewise.comparison.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Engine result for one mode. Metrics are {@code null} when the mode is unavailable;
 * {@code unavailableCode} and {@code unavailableReason} are {@code null} when it is available.
 *
 * @param score           0–100, higher is better; 0 when unavailable
 * @param costSource      {@code null} when unavailable
 * @param costRetrievedAt when a live cost was fetched; {@code null} for an estimate or when unavailable
 * @param via             the connection of a plane option flown via a hub; {@code null} for a direct flight,
 *                        another mode or when unavailable
 */
public record ModeOption(
        TransportModeCode mode,
        boolean available,
        UnavailableCode unavailableCode,
        String unavailableReason,
        double routeKm,
        Integer durationMinutes,
        BigDecimal totalCost,
        BigDecimal co2Kg,
        int score,
        boolean recommended,
        List<String> notes,
        CostSource costSource,
        Instant costRetrievedAt,
        FlightConnection via) {
}
