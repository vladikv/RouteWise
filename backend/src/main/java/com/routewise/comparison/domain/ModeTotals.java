package com.routewise.comparison.domain;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * One mode used for every leg. {@code totals} is {@code null} when the mode is not
 * available on some leg; {@code unavailableReason} then names the first such leg.
 */
public record ModeTotals(TransportModeCode mode, ItineraryTotals totals, String unavailableReason) {

    public boolean available() {
        return totals != null;
    }
}
