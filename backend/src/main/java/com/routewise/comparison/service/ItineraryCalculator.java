package com.routewise.comparison.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import com.routewise.comparison.domain.ItineraryTotals;
import com.routewise.comparison.domain.Leg;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeTotals;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.transportmode.domain.TransportModeCode;

import org.springframework.stereotype.Component;

/**
 * Pure route-level rules on top of the per-leg comparison: the recommended mixed
 * itinerary and the totals for using a single mode throughout. No state, no I/O.
 */
@Component
public class ItineraryCalculator {

    /**
     * Sums each leg's recommended option.
     *
     * @return empty when some leg has no available mode
     */
    public Optional<ItineraryTotals> recommendedItinerary(List<Leg> legs) {
        List<ModeOption> chosen = new ArrayList<>();
        for (Leg leg : legs) {
            Optional<ModeOption> recommended = leg.recommended();
            if (recommended.isEmpty()) {
                return Optional.empty();
            }
            chosen.add(recommended.get());
        }
        return Optional.of(sum(chosen));
    }

    /**
     * One entry per transport mode, in {@link TransportModeCode} order. A mode is only
     * available if it is available on every leg; otherwise the code and reason describe the
     * first leg (1-based) where it is not.
     */
    public List<ModeTotals> singleModeTotals(List<Leg> legs) {
        return Arrays.stream(TransportModeCode.values())
                .map(mode -> totalsFor(mode, legs))
                .toList();
    }

    private static ModeTotals totalsFor(TransportModeCode mode, List<Leg> legs) {
        List<ModeOption> chosen = new ArrayList<>();
        for (int i = 0; i < legs.size(); i++) {
            Leg leg = legs.get(i);
            Optional<ModeOption> option = leg.options().stream().filter(o -> o.mode() == mode).findFirst();
            if (option.isEmpty() || !option.get().available()) {
                String why = option.map(ModeOption::unavailableReason).orElse("mode not offered");
                UnavailableCode code = option.map(ModeOption::unavailableCode).orElse(null);
                return new ModeTotals(mode, null, code, "Leg %d (%s to %s): %s"
                        .formatted(i + 1, leg.from().name(), leg.to().name(), why));
            }
            chosen.add(option.get());
        }
        return new ModeTotals(mode, sum(chosen), null, null);
    }

    private static ItineraryTotals sum(List<ModeOption> options) {
        int minutes = 0;
        BigDecimal cost = BigDecimal.ZERO;
        BigDecimal co2 = BigDecimal.ZERO;
        for (ModeOption option : options) {
            minutes += option.durationMinutes();
            cost = cost.add(option.totalCost());
            co2 = co2.add(option.co2Kg());
        }
        return new ItineraryTotals(options.stream().map(ModeOption::mode).toList(), minutes, cost, co2);
    }
}
