package com.routewise.comparison.dto;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.transportmode.domain.TransportModeCode;

/**
 * One transport mode in a comparison. Metrics are {@code null} when unavailable.
 *
 * @param unavailableCode {@code DIFFERENT_LANDMASS} or {@code TOO_FAR}; {@code null} when available
 * @param distanceKm route distance for this mode (detour factor applied)
 * @param totalCost  for all travelers, in the response currency
 * @param co2Kg      for all travelers
 * @param score      0–100, higher is better
 */
public record ModeOptionResponse(
        TransportModeCode mode,
        boolean available,
        UnavailableCode unavailableCode,
        String unavailableReason,
        BigDecimal distanceKm,
        Integer durationMinutes,
        BigDecimal totalCost,
        BigDecimal co2Kg,
        int score,
        boolean recommended,
        List<String> notes) {
}
