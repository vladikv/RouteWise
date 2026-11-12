package com.routewise.advisor.client;

import java.util.List;
import java.util.stream.Collectors;

import com.routewise.advisor.domain.AdviceContext;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ItineraryTotalsResponse;
import com.routewise.comparison.dto.LegResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.ModeTotalsResponse;
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
        String currency = comparison.currency();
        StringBuilder facts = new StringBuilder()
                .append("Route: %s on %s, %d traveler(s), priority %s, %d leg(s).\n".formatted(
                        context.route(), comparison.departureDate(), comparison.travelers(),
                        comparison.priority(), comparison.legs().size()))
                .append("Straight-line distance: %s km in total. Costs (%s) and CO2 are totals for all travelers.\n"
                        .formatted(comparison.distanceKm(), currency));
        for (LegResponse leg : comparison.legs()) {
            facts.append("Leg %d: %s to %s, %s km straight-line. Modes, best first (score 0-100, weather already "
                            .formatted(leg.index() + 1, leg.from().name(), leg.to().name(), leg.distanceKm()))
                    .append("taken into account):\n");
            leg.options().forEach(option -> facts.append("- ").append(describe(option, currency)).append('\n'));
        }
        facts.append(describeItinerary(comparison.recommendedItinerary(), currency))
                .append(describeSingleModes(comparison.singleModeTotals(), currency))
                .append(describeWeather(comparison.weather()));
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

    private static String describeItinerary(ItineraryTotalsResponse itinerary, String currency) {
        if (itinerary == null) {
            return "Recommended plan: none, because at least one leg has no available mode.\n";
        }
        String modes = itinerary.modes().stream().map(Enum::name).collect(Collectors.joining(", then "));
        return "Recommended plan (each leg's recommended mode): %s; total %d min, %s %s, %s kg CO2.\n".formatted(
                modes, itinerary.durationMinutes(), itinerary.totalCost(), currency, itinerary.co2Kg());
    }

    private static String describeSingleModes(List<ModeTotalsResponse> totals, String currency) {
        return totals.stream()
                .map(mode -> mode.available()
                        ? "- %s for every leg: %d min, %s %s, %s kg CO2".formatted(mode.mode(),
                                mode.durationMinutes(), mode.totalCost(), currency, mode.co2Kg())
                        : "- %s for every leg: not possible (%s)".formatted(mode.mode(), mode.unavailableReason()))
                .collect(Collectors.joining("\n", "Single-mode alternatives:\n", "\n"));
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
