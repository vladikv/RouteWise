package com.routewise.trip.dto;

import java.math.BigDecimal;

import com.routewise.trip.domain.TripPriority;

/**
 * Matching trips of one priority and their summed recommended cost; a trip without figures
 * (no available route) is counted but adds 0 to the cost.
 */
public record PriorityTotalResponse(TripPriority priority, long count, BigDecimal totalCost) {
}
