package com.routewise.trip.dto;

import jakarta.validation.constraints.NotNull;

/** One stop in a trip or comparison request; the list order is the stop order. */
public record TripStopRequest(@NotNull Long cityId) {
}
