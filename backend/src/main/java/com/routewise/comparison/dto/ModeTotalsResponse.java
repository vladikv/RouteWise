package com.routewise.comparison.dto;

import java.math.BigDecimal;

import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.transportmode.domain.TransportModeCode;

/**
 * One mode used for every leg. Metrics are {@code null} when the mode is not
 * available on some leg; {@code unavailableCode} and {@code unavailableReason} then describe that leg.
 */
public record ModeTotalsResponse(
        TransportModeCode mode,
        boolean available,
        UnavailableCode unavailableCode,
        String unavailableReason,
        Integer durationMinutes,
        BigDecimal totalCost,
        BigDecimal co2Kg) {
}
