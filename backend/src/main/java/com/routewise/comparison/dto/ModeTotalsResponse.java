package com.routewise.comparison.dto;

import java.math.BigDecimal;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * One mode used for every leg. Metrics are {@code null} when the mode is not
 * available on some leg; {@code unavailableReason} then names that leg.
 */
public record ModeTotalsResponse(
        TransportModeCode mode,
        boolean available,
        String unavailableReason,
        Integer durationMinutes,
        BigDecimal totalCost,
        BigDecimal co2Kg) {
}
