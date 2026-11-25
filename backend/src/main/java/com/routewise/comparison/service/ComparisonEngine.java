package com.routewise.comparison.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.ToDoubleFunction;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import com.routewise.comparison.domain.ComparisonInput;
import com.routewise.comparison.domain.CostQuote;
import com.routewise.comparison.domain.FlightConnection;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.transportmode.domain.TransportModeCode;

import org.springframework.stereotype.Component;

/**
 * Pure comparison rules for one leg: availability ({@link ModeAvailability}), route distance,
 * duration, cost ({@link CostModel}), CO2 ({@link FlightEmissions}) and score per mode.
 * With a {@link FlightConnection} in the input, the plane flies via the hub: its range applies to
 * each flight, distance and CO2 are per flight, and the connection adds {@link #CONNECTION_MINUTES}.
 * Holds no state and does no I/O.
 */
@Component
public class ComparisonEngine {

    static final int CAR_SEATS = 5;
    /** Time to change planes at a hub, on top of the airport overhead that is counted once. */
    static final int CONNECTION_MINUTES = 120;
    private static final double MINUTES_PER_HOUR = 60;
    private static final BigDecimal GRAMS_PER_KG = BigDecimal.valueOf(1000);

    /**
     * Returns one option per mode, available ones by score (best first), then
     * unavailable ones. The best available option is recommended; if no mode
     * is available, none is. Ranking uses the unrounded score; exact ties go
     * to the earlier {@link TransportModeCode}.
     */
    public List<ModeOption> compare(ComparisonInput input) {
        List<Candidate> candidates = new ArrayList<>();
        List<ModeOption> unavailable = new ArrayList<>();
        for (ModeParameters mode : input.modes()) {
            FlightConnection connection = mode.code() == TransportModeCode.PLANE ? input.connection() : null;
            double routeKm = connection != null
                    ? connection.totalKm()
                    : input.greatCircleKm() * routeFactor(mode.code());
            double longestFlightKm = connection != null ? connection.longestKm() : routeKm;
            ModeAvailability.check(mode, longestFlightKm, input.sameLandmass(), input.citiesWithoutAirport())
                    .ifPresentOrElse(
                            why -> unavailable.add(unavailableOption(mode.code(), routeKm, why)),
                            () -> candidates.add(candidate(mode, routeKm, connection, input)));
        }
        return Stream.concat(
                        rank(candidates, input).stream(),
                        unavailable.stream().sorted(Comparator.comparing(ModeOption::mode)))
                .toList();
    }

    /**
     * Detour factor from straight-line to actual route distance.
     */
    static double routeFactor(TransportModeCode mode) {
        return switch (mode) {
            case TRAIN -> 1.2;
            case BUS, CAR, BIKE -> 1.3;
            case PLANE -> 1.0;
        };
    }

    static int carsNeeded(int travelers) {
        return Math.ceilDiv(travelers, CAR_SEATS);
    }

    private Candidate candidate(ModeParameters mode, double routeKm, FlightConnection connection,
                                ComparisonInput input) {
        List<String> notes = new ArrayList<>();
        int units = input.travelers();
        if (mode.code() == TransportModeCode.CAR) {
            units = carsNeeded(input.travelers());
            if (units > 1) {
                notes.add("%d cars needed for %d travelers".formatted(units, input.travelers()));
            }
        }
        int connectionMinutes = connection != null ? CONNECTION_MINUTES : 0;
        int duration = (int) Math.round(mode.fixedOverheadMinutes() + connectionMinutes
                + routeKm / mode.avgSpeedKmh() * MINUTES_PER_HOUR);
        CostQuote cost = CostModel.quote(mode, routeKm, units, input.pricing());
        BigDecimal co2Kg = BigDecimal.valueOf(co2GramsPerTraveler(mode, routeKm, connection, input) * units)
                .divide(GRAMS_PER_KG, 1, RoundingMode.HALF_UP);
        WeatherImpact.Impact impact = WeatherImpact.assess(mode.code(), input.forecasts());
        notes.addAll(impact.notes());
        return new Candidate(mode.code(), routeKm, duration, cost, co2Kg, impact.multiplier(), notes, connection);
    }

    /** A connecting flight uses each flight's own short- or long-haul factor. */
    private static double co2GramsPerTraveler(ModeParameters mode, double routeKm, FlightConnection connection,
                                              ComparisonInput input) {
        if (connection == null) {
            return FlightEmissions.co2GramsPerKm(mode, input.greatCircleKm()) * routeKm;
        }
        return FlightEmissions.co2GramsPerKm(mode, connection.firstKm()) * connection.firstKm()
                + FlightEmissions.co2GramsPerKm(mode, connection.secondKm()) * connection.secondKm();
    }

    private List<ModeOption> rank(List<Candidate> candidates, ComparisonInput input) {
        ScoreWeights weights = ScoreWeights.forPriority(input.priority());
        Normalizer time = new Normalizer(candidates, Candidate::durationMinutes);
        Normalizer cost = new Normalizer(candidates, candidate -> candidate.cost().amount().doubleValue());
        Normalizer co2 = new Normalizer(candidates, candidate -> candidate.co2Kg().doubleValue());

        List<Scored> scored = candidates.stream()
                .map(candidate -> {
                    double base = weights.time() * time.score(candidate.durationMinutes())
                            + weights.cost() * cost.score(candidate.cost().amount().doubleValue())
                            + weights.co2() * co2.score(candidate.co2Kg().doubleValue());
                    return new Scored(candidate, 100 * base * candidate.weatherMultiplier());
                })
                .sorted(Comparator.comparingDouble(Scored::rawScore).reversed()
                        .thenComparing(entry -> entry.candidate().mode()))
                .toList();

        return IntStream.range(0, scored.size())
                .mapToObj(index -> toOption(scored.get(index), index == 0))
                .toList();
    }

    private static ModeOption toOption(Scored entry, boolean recommended) {
        Candidate candidate = entry.candidate();
        return new ModeOption(candidate.mode(), true, null, null, candidate.routeKm(), candidate.durationMinutes(),
                candidate.cost().amount(), candidate.co2Kg(), (int) Math.round(entry.rawScore()), recommended,
                List.copyOf(candidate.notes()), candidate.cost().source(), candidate.cost().retrievedAt(),
                candidate.connection());
    }

    private static ModeOption unavailableOption(TransportModeCode mode, double routeKm,
                                                ModeAvailability.Unavailable why) {
        return new ModeOption(mode, false, why.code(), why.reason(), routeKm, null, null, null, 0, false,
                List.of(), null, null, null);
    }

    private record Candidate(TransportModeCode mode, double routeKm, int durationMinutes, CostQuote cost,
                             BigDecimal co2Kg, double weatherMultiplier, List<String> notes,
                             FlightConnection connection) {
    }

    private record Scored(Candidate candidate, double rawScore) {
    }

    /**
     * Min-max normalization where the lowest value scores 1 and the highest 0.
     * If all values are equal, every candidate scores 1.
     */
    private static final class Normalizer {

        private final double min;
        private final double max;

        Normalizer(List<Candidate> candidates, ToDoubleFunction<Candidate> metric) {
            this.min = candidates.stream().mapToDouble(metric).min().orElse(0);
            this.max = candidates.stream().mapToDouble(metric).max().orElse(0);
        }

        double score(double value) {
            return max == min ? 1.0 : (max - value) / (max - min);
        }
    }
}
