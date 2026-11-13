package com.routewise.trip.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.routewise.comparison.mapper.ComparisonMapper;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripFigures;
import com.routewise.trip.dto.TripStatsResponse;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Key figures over all active trips of a user, from the same weather-free figures as the list.
 * Deleted trips are not counted.
 */
@Service
@Transactional(readOnly = true)
public class TripStatsService {

    private final TripQueryService tripQueryService;
    private final Clock clock;

    public TripStatsService(TripQueryService tripQueryService, Clock clock) {
        this.tripQueryService = tripQueryService;
        this.clock = clock;
    }

    public TripStatsResponse stats(Long ownerId) {
        List<FiguredTrip> trips = tripQueryService.activeTrips(ownerId);
        return stats(trips, LocalDate.now(clock));
    }

    /** Pure: the stats of trips sorted by departure date (then id), as of {@code today}. */
    static TripStatsResponse stats(List<FiguredTrip> trips, LocalDate today) {
        List<TripFigures> figures = trips.stream().map(FiguredTrip::figures).flatMap(Optional::stream).toList();
        List<TripFigures> withCar = figures.stream().filter(TripFigures::hasCar).toList();
        BigDecimal co2Saved = withCar.stream()
                .map(f -> f.carCo2Kg().subtract(f.co2Kg()).max(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(1, RoundingMode.HALF_UP);
        BigDecimal averageCost = figures.isEmpty()
                ? null
                : figures.stream().map(TripFigures::totalCost).reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(figures.size()), 2, RoundingMode.HALF_UP);
        TripStatsResponse.NextTrip nextTrip = trips.stream()
                .map(FiguredTrip::trip)
                .filter(trip -> !trip.getDepartureDate().isBefore(today))
                .findFirst()
                .map(TripStatsService::nextTrip)
                .orElse(null);
        return new TripStatsResponse(trips.size(), co2Saved, withCar.size(), trips.size() - withCar.size(),
                averageCost, ComparisonMapper.CURRENCY, nextTrip);
    }

    private static TripStatsResponse.NextTrip nextTrip(Trip trip) {
        return new TripStatsResponse.NextTrip(trip.getId(), trip.getTitle(), trip.getDepartureDate());
    }
}
