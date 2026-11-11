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
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.transportmode.domain.TransportModeCode;

import org.springframework.stereotype.Component;

/**
 * Pure comparison rules: route distance, duration, cost, CO2 and score per mode.
 * Holds no state and does no I/O.
 */
@Component
public class ComparisonEngine {

    static final int CAR_SEATS = 5;
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
            double routeKm = input.greatCircleKm() * routeFactor(mode.code());
            if (routeKm > mode.maxDistanceKm()) {
                unavailable.add(unavailableOption(mode, routeKm));
            } else {
                candidates.add(candidate(mode, routeKm, input));
            }
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

    private Candidate candidate(ModeParameters mode, double routeKm, ComparisonInput input) {
        List<String> notes = new ArrayList<>();
        int units = input.travelers();
        if (mode.code() == TransportModeCode.CAR) {
            units = carsNeeded(input.travelers());
            if (units > 1) {
                notes.add("%d cars needed for %d travelers".formatted(units, input.travelers()));
            }
        }
        int duration = (int) Math.round(mode.fixedOverheadMinutes() + routeKm / mode.avgSpeedKmh() * MINUTES_PER_HOUR);
        BigDecimal unitKm = BigDecimal.valueOf(routeKm * units);
        BigDecimal cost = mode.costPerKm().multiply(unitKm).setScale(2, RoundingMode.HALF_UP);
        BigDecimal co2Kg = BigDecimal.valueOf(mode.co2GramsPerKm()).multiply(unitKm)
                .divide(GRAMS_PER_KG, 1, RoundingMode.HALF_UP);
        WeatherImpact.Impact impact = WeatherImpact.assess(mode.code(), input.forecasts());
        notes.addAll(impact.notes());
        return new Candidate(mode.code(), routeKm, duration, cost, co2Kg, impact.multiplier(), notes);
    }

    private List<ModeOption> rank(List<Candidate> candidates, ComparisonInput input) {
        ScoreWeights weights = ScoreWeights.forPriority(input.priority());
        Normalizer time = new Normalizer(candidates, Candidate::durationMinutes);
        Normalizer cost = new Normalizer(candidates, candidate -> candidate.cost().doubleValue());
        Normalizer co2 = new Normalizer(candidates, candidate -> candidate.co2Kg().doubleValue());

        List<Scored> scored = candidates.stream()
                .map(candidate -> {
                    double base = weights.time() * time.score(candidate.durationMinutes())
                            + weights.cost() * cost.score(candidate.cost().doubleValue())
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
        return new ModeOption(candidate.mode(), true, null, candidate.routeKm(), candidate.durationMinutes(),
                candidate.cost(), candidate.co2Kg(), (int) Math.round(entry.rawScore()), recommended,
                List.copyOf(candidate.notes()));
    }

    private static ModeOption unavailableOption(ModeParameters mode, double routeKm) {
        String reason = "Route of %d km exceeds the %s limit of %d km"
                .formatted(Math.round(routeKm), mode.code(), mode.maxDistanceKm());
        return new ModeOption(mode.code(), false, reason, routeKm, null, null, null, 0, false, List.of());
    }

    private record Candidate(TransportModeCode mode, double routeKm, int durationMinutes, BigDecimal cost,
                             BigDecimal co2Kg, double weatherMultiplier, List<String> notes) {
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
