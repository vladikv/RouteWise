package com.routewise.comparison.domain;

import java.util.List;

import com.routewise.pricing.domain.LegPricing;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.LocationForecast;

/**
 * Everything the comparison engine needs for one leg; {@code forecasts} may be empty.
 *
 * @param sameLandmass whether both cities share a landmass (ground modes need it)
 * @param pricing      the leg's regional prices; {@link LegPricing#NONE} uses each mode's per-km cost
 */
public record ComparisonInput(
        double greatCircleKm,
        boolean sameLandmass,
        int travelers,
        TripPriority priority,
        List<ModeParameters> modes,
        LegPricing pricing,
        List<LocationForecast> forecasts) {
}
