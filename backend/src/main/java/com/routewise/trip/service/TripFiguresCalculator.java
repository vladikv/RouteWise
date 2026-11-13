package com.routewise.trip.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

import com.routewise.city.dto.CitySummary;
import com.routewise.comparison.domain.ItineraryTotals;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.domain.ModeTotals;
import com.routewise.comparison.domain.RoutePlan;
import com.routewise.comparison.domain.RouteStop;
import com.routewise.comparison.service.RoutePlanner;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripFigures;

import org.springframework.stereotype.Component;

/**
 * A trip's list figures: the same {@link RoutePlanner} as the comparison, but without weather,
 * so the list and the stats need no external call. The arithmetic in {@link #figures(RoutePlan)}
 * is pure.
 */
@Component
public class TripFiguresCalculator {

    private final RoutePlanner routePlanner;

    public TripFiguresCalculator(RoutePlanner routePlanner) {
        this.routePlanner = routePlanner;
    }

    /** Empty when some leg has no available mode. The trip's stops and cities must be loaded. */
    public Optional<TripFigures> figures(Trip trip, List<ModeParameters> modes) {
        List<RouteStop> stops = trip.stopCities().stream()
                .map(city -> new RouteStop(new CitySummary(city.getId(), city.getName(), city.getCountry()),
                        city.getLatitude(), city.getLongitude(), city.getLandmass()))
                .toList();
        RoutePlan plan = routePlanner.plan(stops, trip.getTravelers(), trip.getPriority(), modes, List.of());
        return figures(plan);
    }

    static Optional<TripFigures> figures(RoutePlan plan) {
        ItineraryTotals itinerary = plan.recommendedItinerary();
        if (itinerary == null) {
            return Optional.empty();
        }
        BigDecimal car = plan.singleModeTotals().stream()
                .filter(totals -> totals.mode() == TransportModeCode.CAR && totals.available())
                .map(ModeTotals::totals)
                .map(ItineraryTotals::co2Kg)
                .findFirst()
                .orElse(null);
        return Optional.of(new TripFigures(
                itinerary.totalCost(),
                itinerary.co2Kg(),
                car,
                co2VsCarPercent(itinerary.co2Kg(), car),
                co2ShareOfCar(itinerary.co2Kg(), car),
                itinerary.modes().stream().distinct().toList(),
                itinerary.modes()));
    }

    /** {@code round((plan / car - 1) * 100)}; null without a positive car figure. */
    private static Integer co2VsCarPercent(BigDecimal plan, BigDecimal car) {
        if (car == null || car.signum() <= 0) {
            return null;
        }
        return plan.divide(car, 6, RoundingMode.HALF_UP)
                .subtract(BigDecimal.ONE)
                .movePointRight(2)
                .setScale(0, RoundingMode.HALF_UP)
                .intValueExact();
    }

    /** {@code min(plan / car, 1)} with two decimals; null without a positive car figure. */
    private static BigDecimal co2ShareOfCar(BigDecimal plan, BigDecimal car) {
        if (car == null || car.signum() <= 0) {
            return null;
        }
        return plan.divide(car, 2, RoundingMode.HALF_UP).min(BigDecimal.ONE.setScale(2));
    }
}
