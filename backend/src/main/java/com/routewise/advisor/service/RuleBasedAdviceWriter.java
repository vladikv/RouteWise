package com.routewise.advisor.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import com.routewise.advisor.domain.AdviceContext;
import com.routewise.advisor.domain.AdviceText;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ItineraryTotalsResponse;
import com.routewise.comparison.dto.LegResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.ModeTotalsResponse;
import com.routewise.comparison.dto.WeatherSummary;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.WeatherHazard;

import org.springframework.stereotype.Component;

/**
 * Template-based advice, used when no LLM is configured or it fails. Explains
 * the recommended itinerary leg by leg, the best alternative and the weather.
 * Holds no state and does no I/O.
 */
@Component
public class RuleBasedAdviceWriter {

    public AdviceText write(AdviceContext context) {
        ComparisonResponse comparison = context.comparison();
        List<String> legs = comparison.legs().stream().map(leg -> legSentence(leg, comparison.currency())).toList();
        Optional<LegResponse> blocked = comparison.legs().stream()
                .filter(leg -> leg.recommendedMode() == null)
                .findFirst();
        if (blocked.isPresent()) {
            return noModeAvailable(context, blocked.get(), legs);
        }
        List<String> tips = new ArrayList<>();
        String summary;
        if (comparison.legs().size() == 1) {
            ModeOptionResponse best = recommended(comparison.legs().getFirst());
            comparison.legs().getFirst().options().stream()
                    .filter(option -> option.available() && !option.recommended())
                    .findFirst()
                    .ifPresent(alternative -> tips.add(compare(alternative, best, comparison.currency())));
            summary = "Take the %s from %s to %s: %s, %s %s and %s kg CO₂ for %s. It is the best match for %s."
                    .formatted(modeName(best.mode()), context.stops().getFirst(), context.stops().getLast(),
                            duration(best.durationMinutes()), best.totalCost(), comparison.currency(), best.co2Kg(),
                            travelers(comparison.travelers()), priorityPhrase(comparison.priority()));
        } else {
            ItineraryTotalsResponse plan = comparison.recommendedItinerary();
            bestSingleModeAlternative(comparison).ifPresent(alternative -> tips.add(compare(alternative, plan,
                    comparison.currency())));
            summary = ("Recommended plan for %s: %s. In total %s, %s %s and %s kg CO₂ for %s; "
                    + "each leg is the best match for %s.").formatted(context.route(), modesPhrase(plan.modes()),
                    duration(plan.durationMinutes()), plan.totalCost(), comparison.currency(), plan.co2Kg(),
                    travelers(comparison.travelers()), priorityPhrase(comparison.priority()));
        }
        tips.addAll(recommendedNotes(comparison));
        tips.addAll(weatherTips(comparison.weather()));
        return new AdviceText(summary, legs, List.copyOf(tips));
    }

    private static AdviceText noModeAvailable(AdviceContext context, LegResponse leg, List<String> legs) {
        String summary = context.comparison().legs().size() == 1
                ? "No transport mode is available from %s to %s.".formatted(leg.from().name(), leg.to().name())
                : "No complete plan is possible for %s: no transport mode is available on leg %d (%s to %s)."
                        .formatted(context.route(), leg.index() + 1, leg.from().name(), leg.to().name());
        List<String> reasons = leg.options().stream()
                .map(ModeOptionResponse::unavailableReason)
                .filter(Objects::nonNull)
                .toList();
        return new AdviceText(summary, legs, reasons);
    }

    /** E.g. "Leg 1, Berlin to Prague: train, 3 h 10 min, 40.00 EUR and 12.0 kg CO₂." */
    static String legSentence(LegResponse leg, String currency) {
        String prefix = "Leg %d, %s to %s: ".formatted(leg.index() + 1, leg.from().name(), leg.to().name());
        if (leg.recommendedMode() == null) {
            return prefix + "no transport mode is available.";
        }
        ModeOptionResponse best = recommended(leg);
        return prefix + "%s, %s, %s %s and %s kg CO₂.".formatted(modeName(best.mode()),
                duration(best.durationMinutes()), best.totalCost(), currency, best.co2Kg());
    }

    private static ModeOptionResponse recommended(LegResponse leg) {
        return leg.options().stream().filter(ModeOptionResponse::recommended).findFirst().orElseThrow();
    }

    /**
     * The available single-mode plan, other than the recommended plan itself, that is best on the
     * trip's main metric (time for FASTEST and BALANCED, cost for CHEAPEST, CO₂ for GREENEST).
     */
    private static Optional<ModeTotalsResponse> bestSingleModeAlternative(ComparisonResponse comparison) {
        List<TransportModeCode> planModes = comparison.recommendedItinerary().modes();
        Comparator<ModeTotalsResponse> metric = switch (comparison.priority()) {
            case CHEAPEST -> Comparator.comparing(ModeTotalsResponse::totalCost);
            case GREENEST -> Comparator.comparing(ModeTotalsResponse::co2Kg);
            case FASTEST, BALANCED -> Comparator.comparing(ModeTotalsResponse::durationMinutes);
        };
        return comparison.singleModeTotals().stream()
                .filter(ModeTotalsResponse::available)
                .filter(totals -> !planModes.stream().allMatch(mode -> mode == totals.mode()))
                .min(metric);
    }

    /** E.g. "Alternative: bus, 1 h 20 min slower, 60.00 EUR cheaper and 10.0 kg more CO₂." */
    static String compare(ModeOptionResponse alternative, ModeOptionResponse best, String currency) {
        return "Alternative: %s, %s.".formatted(modeName(alternative.mode()), differences(
                alternative.durationMinutes() - best.durationMinutes(),
                alternative.totalCost().subtract(best.totalCost()),
                alternative.co2Kg().subtract(best.co2Kg()), currency));
    }

    /** E.g. "Alternative: the train for every leg, 40 min slower, 12.00 EUR cheaper and 3.0 kg less CO₂." */
    static String compare(ModeTotalsResponse alternative, ItineraryTotalsResponse plan, String currency) {
        return "Alternative: the %s for every leg, %s.".formatted(modeName(alternative.mode()), differences(
                alternative.durationMinutes() - plan.durationMinutes(),
                alternative.totalCost().subtract(plan.totalCost()),
                alternative.co2Kg().subtract(plan.co2Kg()), currency));
    }

    private static String differences(int minutes, BigDecimal costDiff, BigDecimal co2Diff, String currency) {
        String time = minutes == 0 ? "same travel time"
                : duration(Math.abs(minutes)) + (minutes > 0 ? " slower" : " faster");
        String cost = costDiff.signum() == 0 ? "same cost"
                : costDiff.abs() + " " + currency + (costDiff.signum() > 0 ? " more expensive" : " cheaper");
        String co2 = co2Diff.signum() == 0 ? "same CO₂"
                : co2Diff.abs() + " kg " + (co2Diff.signum() > 0 ? "more" : "less") + " CO₂";
        return "%s, %s and %s".formatted(time, cost, co2);
    }

    /** E.g. [TRAIN, BUS, TRAIN] → "train, then bus, then train"; [BUS, BUS] → "bus all the way". */
    static String modesPhrase(List<TransportModeCode> modes) {
        if (modes.stream().distinct().count() == 1) {
            return modeName(modes.getFirst()) + " all the way";
        }
        return modes.stream().map(RuleBasedAdviceWriter::modeName).collect(Collectors.joining(", then "));
    }

    /** Practical notes (e.g. weather penalties, several cars) of each leg's recommended mode, each once. */
    private static List<String> recommendedNotes(ComparisonResponse comparison) {
        Set<String> notes = new LinkedHashSet<>();
        comparison.legs().forEach(leg -> notes.addAll(recommended(leg).notes()));
        return List.copyOf(notes);
    }

    private static List<String> weatherTips(List<WeatherSummary> weather) {
        if (weather.isEmpty()) {
            return List.of("No weather forecast is available for the departure date, "
                    + "so the weather is not taken into account.");
        }
        return weather.stream().map(RuleBasedAdviceWriter::weatherTip).toList();
    }

    /** E.g. "Weather in Vienna on 2026-11-20: Rain, 4 to 9 °C, 90% chance of precipitation. Expect rain." */
    static String weatherTip(WeatherSummary summary) {
        StringBuilder tip = new StringBuilder("Weather in %s on %s: %s"
                .formatted(summary.city(), summary.date(), summary.description()));
        if (summary.temperatureMinC() != null && summary.temperatureMaxC() != null) {
            tip.append(", %d to %d °C".formatted(Math.round(summary.temperatureMinC()),
                    Math.round(summary.temperatureMaxC())));
        }
        if (summary.precipitationProbabilityPercent() != null) {
            tip.append(", %d%% chance of precipitation".formatted(summary.precipitationProbabilityPercent()));
        }
        tip.append('.');
        if (!summary.hazards().isEmpty()) {
            tip.append(" Expect ").append(summary.hazards().stream()
                    .sorted()
                    .map(WeatherHazard::label)
                    .collect(Collectors.joining(", "))).append('.');
        }
        return tip.toString();
    }

    /** E.g. 373 → "6 h 13 min", 180 → "3 h", 45 → "45 min". */
    static String duration(int totalMinutes) {
        int hours = totalMinutes / 60;
        int minutes = totalMinutes % 60;
        if (hours == 0) {
            return minutes + " min";
        }
        return minutes == 0 ? hours + " h" : "%d h %d min".formatted(hours, minutes);
    }

    private static String modeName(TransportModeCode mode) {
        return mode.name().toLowerCase(Locale.ROOT);
    }

    private static String travelers(int travelers) {
        return travelers == 1 ? "1 traveler" : travelers + " travelers";
    }

    private static String priorityPhrase(TripPriority priority) {
        return switch (priority) {
            case FASTEST -> "your priority: speed";
            case CHEAPEST -> "your priority: low cost";
            case GREENEST -> "your priority: low emissions";
            case BALANCED -> "a balance of time, cost and CO₂";
        };
    }
}
