package com.routewise.comparison.service;

import java.util.ArrayList;
import java.util.List;

import com.routewise.comparison.domain.ComparisonInput;
import com.routewise.comparison.domain.Leg;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.domain.ModeTotals;
import com.routewise.comparison.domain.RoutePlan;
import com.routewise.comparison.domain.RouteStop;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.LocationForecast;

import org.springframework.stereotype.Component;

/**
 * Pure: compares a route of two or more stops leg by leg. Runs the {@link ComparisonEngine}
 * per leg with that leg's weather (forecasts of its two cities; may be empty), then combines
 * the legs with the {@link ItineraryCalculator} and groups unavailable modes with the
 * {@link UnavailableGrouper}. Used for full comparisons and for the weather-free trip figures.
 */
@Component
public class RoutePlanner {

    private final ComparisonEngine comparisonEngine;
    private final ItineraryCalculator itineraryCalculator;
    private final UnavailableGrouper unavailableGrouper;

    public RoutePlanner(ComparisonEngine comparisonEngine, ItineraryCalculator itineraryCalculator,
                        UnavailableGrouper unavailableGrouper) {
        this.comparisonEngine = comparisonEngine;
        this.itineraryCalculator = itineraryCalculator;
        this.unavailableGrouper = unavailableGrouper;
    }

    public RoutePlan plan(List<RouteStop> stops, int travelers, TripPriority priority, List<ModeParameters> modes,
                          List<LocationForecast> forecasts) {
        List<Leg> legs = new ArrayList<>();
        for (int i = 0; i + 1 < stops.size(); i++) {
            legs.add(leg(stops.get(i), stops.get(i + 1), travelers, priority, modes, forecasts));
        }
        List<ModeTotals> totals = itineraryCalculator.singleModeTotals(legs);
        return new RoutePlan(
                legs,
                itineraryCalculator.recommendedItinerary(legs).orElse(null),
                totals,
                legs.stream().map(unavailableGrouper::forLeg).toList(),
                unavailableGrouper.forTotals(totals, legs));
    }

    private Leg leg(RouteStop from, RouteStop to, int travelers, TripPriority priority, List<ModeParameters> modes,
                    List<LocationForecast> forecasts) {
        double distanceKm = GeoDistance.haversineKm(from.latitude(), from.longitude(), to.latitude(), to.longitude());
        List<LocationForecast> legWeather = forecasts.stream()
                .filter(f -> f.location().name().equals(from.city().name())
                        || f.location().name().equals(to.city().name()))
                .toList();
        List<ModeOption> options = comparisonEngine.compare(new ComparisonInput(distanceKm,
                from.landmass().equals(to.landmass()), travelers, priority, modes, legWeather));
        return new Leg(from.city(), to.city(), distanceKm, options);
    }
}
