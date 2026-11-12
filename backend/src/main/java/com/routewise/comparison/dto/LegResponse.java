package com.routewise.comparison.dto;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.city.dto.CitySummary;
import com.routewise.transportmode.domain.TransportModeCode;

/**
 * One leg of the route (stop {@code index} to stop {@code index + 1}).
 *
 * @param distanceKm      straight-line distance between the two stops
 * @param options         every mode for this leg, best available first, weather-adjusted
 * @param recommendedMode {@code null} when no mode is available on this leg
 */
public record LegResponse(
        int index,
        CitySummary from,
        CitySummary to,
        BigDecimal distanceKm,
        List<ModeOptionResponse> options,
        TransportModeCode recommendedMode) {
}
