package com.routewise.advisor.client;

import java.util.List;
import java.util.stream.Collectors;

import com.routewise.advisor.domain.AdviceContext;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.WeatherSummary;
import com.routewise.weather.domain.WeatherHazard;

/**
 * Renders an {@link AdviceContext} as plain-text facts for the LLM prompt.
 * Pure function; the model words the advice from these facts only.
 */
final class AdviceFacts {

    private AdviceFacts() {
    }

    static String describe(AdviceContext context) {
        ComparisonResponse comparison = context.comparison();
        StringBuilder facts = new StringBuilder()
                .append("Trip: %s to %s on %s, %d traveler(s), priority %s.\n".formatted(
                        context.originCity(), context.destinationCity(), comparison.departureDate(),
                        comparison.travelers(), comparison.priority()))
                .append("Straight-line distance: %s km. Costs (%s) and CO2 are totals for all travelers.\n"
                        .formatted(comparison.distanceKm(), comparison.currency()))
                .append("Modes, best first (score 0-100, weather already taken into account):\n");
        comparison.options().forEach(option ->
                facts.append("- ").append(describe(option, comparison.currency())).append('\n'));
        facts.append(describeWeather(comparison.weather()));
        return facts.toString();
    }

    private static String describe(ModeOptionResponse option, String currency) {
        if (!option.available()) {
            return "%s: unavailable (%s)".formatted(option.mode(), option.unavailableReason());
        }
        String line = "%s%s: %d min, %s %s, %s kg CO2, score %d".formatted(option.mode(),
                option.recommended() ? " (recommended)" : "", option.durationMinutes(),
                option.totalCost(), currency, option.co2Kg(), option.score());
        return option.notes().isEmpty() ? line : line + ". Notes: " + String.join(" ", option.notes());
    }

    private static String describeWeather(List<WeatherSummary> weather) {
        if (weather.isEmpty()) {
            return "Weather: no forecast available for the departure date.";
        }
        return weather.stream()
                .map(summary -> "- %s on %s: %s, %s to %s °C, precipitation %s%%, wind up to %s km/h, hazards: %s"
                        .formatted(summary.city(), summary.date(), summary.description(),
                                summary.temperatureMinC(), summary.temperatureMaxC(),
                                summary.precipitationProbabilityPercent(), summary.windSpeedMaxKmh(),
                                hazards(summary)))
                .collect(Collectors.joining("\n", "Weather:\n", ""));
    }

    private static String hazards(WeatherSummary summary) {
        if (summary.hazards().isEmpty()) {
            return "none";
        }
        return summary.hazards().stream().map(WeatherHazard::label).sorted().collect(Collectors.joining(", "));
    }
}
