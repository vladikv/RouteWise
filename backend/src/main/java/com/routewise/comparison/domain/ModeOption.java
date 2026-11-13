package com.routewise.comparison.domain;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Engine result for one mode. Metrics are {@code null} when the mode is unavailable;
 * {@code unavailableCode} and {@code unavailableReason} are {@code null} when it is available.
 *
 * @param score 0–100, higher is better; 0 when unavailable
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
        List<String> notes) {
}
