package com.routewise.comparison.dto;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Totals for the whole route; cost and CO2 are for all travelers.
 *
 * @param modes the mode used on each leg, in leg order
 */
public record ItineraryTotalsResponse(
        List<TransportModeCode> modes,
        int durationMinutes,
        BigDecimal totalCost,
        BigDecimal co2Kg) {
}
