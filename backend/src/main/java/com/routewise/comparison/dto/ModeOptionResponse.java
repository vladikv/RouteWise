package com.routewise.comparison.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.routewise.comparison.domain.CostSource;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.transportmode.domain.TransportModeCode;

/**
 * One transport mode in a comparison. Metrics are {@code null} when unavailable.
 *
 * @param unavailableCode {@code DIFFERENT_LANDMASS}, {@code TOO_FAR} or {@code NO_AIRPORT}; {@code null} when available
 * @param distanceKm route distance for this mode (detour factor applied)
 * @param totalCost  for all travelers, in the response currency
 * @param co2Kg      for all travelers
 * @param score      0–100, higher is better
 * @param costSource {@code ESTIMATE} (seeded regional prices) or {@code LIVE} (the cheapest live flight,
 *                   plane only); {@code null} when unavailable
 * @param costRetrievedAt when the live fare was fetched; {@code null} for an estimate
 * @param via        the hub of a plane option with one connection (legs too long to fly non-stop);
 *                   {@code null} for a direct flight, every other mode and when unavailable
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
        List<String> notes,
        CostSource costSource,
        Instant costRetrievedAt,
        ConnectionResponse via) {
}
