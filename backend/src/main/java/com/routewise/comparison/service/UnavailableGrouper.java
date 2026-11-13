package com.routewise.comparison.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;

import com.routewise.comparison.domain.Leg;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeTotals;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.comparison.domain.UnavailableGroup;
import com.routewise.transportmode.domain.TransportModeCode;

import org.springframework.stereotype.Component;

/**
 * Pure rule: turns the per-mode unavailability of a route into one readable sentence per
 * reason, per leg and for the whole trip. Modes are listed in {@link TransportModeCode} order.
 */
@Component
public class UnavailableGrouper {

    /** Earlier legs first; on the same leg, reasons in {@link UnavailableCode} order. */
    private static final Comparator<Blocker> BLOCKER_ORDER =
            Comparator.comparingInt(Blocker::legIndex).thenComparing(Blocker::code);

    /** One group per reason on this leg, in {@link UnavailableCode} order; empty when all modes are available. */
    public List<UnavailableGroup> forLeg(Leg leg) {
        Map<UnavailableCode, List<TransportModeCode>> byCode = leg.options().stream()
                .filter(option -> !option.available())
                .sorted(Comparator.comparing(ModeOption::mode))
                .collect(Collectors.groupingBy(ModeOption::unavailableCode,
                        TreeMap::new, Collectors.mapping(ModeOption::mode, Collectors.toList())));
        return byCode.entrySet().stream()
                .map(entry -> new UnavailableGroup(entry.getKey(), entry.getValue(),
                        legSentence(entry.getKey(), leg) + ": " + modeList(entry.getValue())))
                .toList();
    }

    /**
     * One group per first blocking leg and reason, for the modes that cannot be used on every leg,
     * e.g. "Not possible for the whole trip: train, bus, car, bike (no land route between Dublin and Madrid)".
     */
    public List<UnavailableGroup> forTotals(List<ModeTotals> totals, List<Leg> legs) {
        Map<Blocker, List<TransportModeCode>> byBlocker = new LinkedHashMap<>();
        totals.stream()
                .filter(modeTotals -> !modeTotals.available())
                .sorted(Comparator.comparing(ModeTotals::mode))
                .forEach(modeTotals -> firstBlocker(modeTotals.mode(), legs).ifPresent(blocker ->
                        byBlocker.computeIfAbsent(blocker, key -> new ArrayList<>()).add(modeTotals.mode())));
        return byBlocker.entrySet().stream()
                .sorted(Map.Entry.comparingByKey(BLOCKER_ORDER))
                .map(entry -> new UnavailableGroup(entry.getKey().code(), entry.getValue(),
                        "Not possible for the whole trip: %s (%s)".formatted(modeList(entry.getValue()),
                                totalsReason(entry.getKey().code(), legs.get(entry.getKey().legIndex())))))
                .toList();
    }

    private static Optional<Blocker> firstBlocker(TransportModeCode mode, List<Leg> legs) {
        for (int i = 0; i < legs.size(); i++) {
            Optional<ModeOption> option = legs.get(i).options().stream().filter(o -> o.mode() == mode).findFirst();
            if (option.isPresent() && !option.get().available()) {
                return Optional.of(new Blocker(i, option.get().unavailableCode()));
            }
        }
        return Optional.empty();
    }

    private static String legSentence(UnavailableCode code, Leg leg) {
        String between = "between %s and %s".formatted(leg.from().name(), leg.to().name());
        return switch (code) {
            case DIFFERENT_LANDMASS -> "Not reachable by land " + between;
            case TOO_FAR -> "Too far " + between + " for";
        };
    }

    private static String totalsReason(UnavailableCode code, Leg leg) {
        String between = "between %s and %s".formatted(leg.from().name(), leg.to().name());
        return switch (code) {
            case DIFFERENT_LANDMASS -> "no land route " + between;
            case TOO_FAR -> "too far " + between;
        };
    }

    private static String modeList(List<TransportModeCode> modes) {
        return modes.stream().map(mode -> mode.name().toLowerCase(Locale.ROOT)).collect(Collectors.joining(", "));
    }

    /** The first leg on which a mode is unavailable, and why. */
    private record Blocker(int legIndex, UnavailableCode code) {
    }
}
