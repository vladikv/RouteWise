package com.routewise.weather.domain;

/** How complete the weather behind a comparison is. */
public enum WeatherStatus {
    /** A forecast for every stop city. */
    AVAILABLE,
    /** Forecasts for some stop cities; the provider failed or had no data for the others. */
    PARTIAL,
    /** No forecast although the date is in the forecast window: the provider failed or timed out. */
    UNAVAILABLE,
    /** The date is outside the provider's forecast window (past, or more than 15 days ahead). */
    OUT_OF_RANGE
}
