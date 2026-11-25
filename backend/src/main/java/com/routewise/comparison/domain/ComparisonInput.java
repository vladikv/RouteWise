package com.routewise.comparison.domain;

import java.util.List;

import com.routewise.pricing.domain.LegPricing;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.LocationForecast;

/**
 * Everything the comparison engine needs for one leg; {@code forecasts} may be empty.
 *
 * @param sameLandmass         whether both cities share a landmass (ground modes need it)
 * @param citiesWithoutAirport names of the leg's cities without a working airport (the plane is unavailable if any)
 * @param pricing              the leg's regional prices; {@link LegPricing#NONE} uses each mode's per-km cost
 * @param connection           the plane's connecting flight when the leg is too long to fly non-stop
 *                             ({@link com.routewise.comparison.service.HubRouter}); {@code null} for a direct flight
 */
public record ComparisonInput(
        double greatCircleKm,
        boolean sameLandmass,
        List<String> citiesWithoutAirport,
        int travelers,
        TripPriority priority,
        List<ModeParameters> modes,
        LegPricing pricing,
        List<LocationForecast> forecasts,
        FlightConnection connection) {
}
