package com.routewise.comparison.domain;

import java.util.List;

import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.LocationForecast;

/**
 * Everything the comparison engine needs; {@code forecasts} may be empty.
 */
public record ComparisonInput(
        double greatCircleKm,
        int travelers,
        TripPriority priority,
        List<ModeParameters> modes,
        List<LocationForecast> forecasts) {
}
