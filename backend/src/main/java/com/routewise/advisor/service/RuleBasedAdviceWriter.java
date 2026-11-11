package com.routewise.advisor.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import com.routewise.advisor.domain.AdviceContext;
import com.routewise.advisor.domain.AdviceText;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.WeatherSummary;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.WeatherHazard;

import org.springframework.stereotype.Component;

/**
 * Template-based advice, used when no LLM is configured or it fails. Explains
 * the comparison's recommendation, the best alternative and the weather.
 * Holds no state and does no I/O.
 */
@Component
public class RuleBasedAdviceWriter {

    public AdviceText write(AdviceContext context) {
        ComparisonResponse comparison = context.comparison();
        Optional<ModeOptionResponse> recommended = comparison.options().stream()
                .filter(ModeOptionResponse::recommended)
                .findFirst();
        if (recommended.isEmpty()) {
            return noModeAvailable(context);
        }
        ModeOptionResponse best = recommended.get();
        List<String> tips = new ArrayList<>();
        comparison.options().stream()
                .filter(option -> option.available() && !option.recommended())
                .findFirst()
                .ifPresent(alternative -> tips.add(compare(alternative, best, comparison.currency())));
        tips.addAll(best.notes());
        tips.addAll(weatherTips(comparison.weather()));
        String summary = "Take the %s from %s to %s: %s, %s %s and %s kg CO₂ for %s. It is the best match for %s."
                .formatted(modeName(best), context.originCity(), context.destinationCity(),
                        duration(best.durationMinutes()), best.totalCost(), comparison.currency(), best.co2Kg(),
                        travelers(comparison.travelers()), priorityPhrase(comparison.priority()));
        return new AdviceText(summary, List.copyOf(tips));
    }

    private static AdviceText noModeAvailable(AdviceContext context) {
        String summary = "No transport mode is available from %s to %s."
                .formatted(context.originCity(), context.destinationCity());
        List<String> reasons = context.comparison().options().stream()
                .map(ModeOptionResponse::unavailableReason)
                .filter(Objects::nonNull)
                .toList();
        return new AdviceText(summary, reasons);
    }

    /** E.g. "Alternative: bus, 1 h 20 min slower, 60.00 EUR cheaper and 10.0 kg more CO₂." */
    static String compare(ModeOptionResponse alternative, ModeOptionResponse best, String currency) {
        int minutes = alternative.durationMinutes() - best.durationMinutes();
        String time = minutes == 0 ? "same travel time"
                : duration(Math.abs(minutes)) + (minutes > 0 ? " slower" : " faster");
        BigDecimal costDiff = alternative.totalCost().subtract(best.totalCost());
        String cost = costDiff.signum() == 0 ? "same cost"
                : costDiff.abs() + " " + currency + (costDiff.signum() > 0 ? " more expensive" : " cheaper");
        BigDecimal co2Diff = alternative.co2Kg().subtract(best.co2Kg());
        String co2 = co2Diff.signum() == 0 ? "same CO₂"
                : co2Diff.abs() + " kg " + (co2Diff.signum() > 0 ? "more" : "less") + " CO₂";
        return "Alternative: %s, %s, %s and %s.".formatted(modeName(alternative), time, cost, co2);
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

    private static String modeName(ModeOptionResponse option) {
        return option.mode().name().toLowerCase(Locale.ROOT);
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
