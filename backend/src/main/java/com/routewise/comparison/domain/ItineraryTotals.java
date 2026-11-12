package com.routewise.comparison.domain;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Totals of a whole route when each leg uses the mode given in {@code modes}
 * (one entry per leg, in order). Cost and CO2 are for all travelers.
 */
public record ItineraryTotals(
        List<TransportModeCode> modes,
        int durationMinutes,
        BigDecimal totalCost,
        BigDecimal co2Kg) {
}
