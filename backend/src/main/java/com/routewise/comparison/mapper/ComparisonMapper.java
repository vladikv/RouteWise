package com.routewise.comparison.mapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.IntStream;

import com.routewise.comparison.domain.ItineraryTotals;
import com.routewise.comparison.domain.Leg;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.domain.ModeTotals;
import com.routewise.comparison.domain.RoutePlan;
import com.routewise.comparison.domain.UnavailableGroup;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ItineraryTotalsResponse;
import com.routewise.comparison.dto.LegResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.ModeTotalsResponse;
import com.routewise.comparison.dto.UnavailableGroupResponse;
import com.routewise.comparison.dto.WeatherSummary;
import com.routewise.transportmode.domain.TransportMode;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.domain.WeatherForecast;
import com.routewise.weather.domain.WeatherReport;

import org.springframework.stereotype.Component;

@Component
public class ComparisonMapper {

    /** All prices are in this currency. */
    public static final String CURRENCY = "EUR";

    public ModeParameters toParameters(TransportMode mode) {
        return new ModeParameters(mode.getCode(), mode.getAvgSpeedKmh(), mode.getCostPerKm(),
                mode.getCo2GramsPerKm(), mode.getFixedOverheadMinutes(), mode.getMaxDistanceKm(),
                mode.getLongHaulCo2GramsPerKm());
    }

    /**
     * @param tripId {@code null} for a comparison that does not belong to a stored trip
     */
    public ComparisonResponse toResponse(Long tripId, LocalDate departureDate, int travelers, TripPriority priority,
                                         WeatherReport weather, RoutePlan plan) {
        List<Leg> legs = plan.legs();
        ItineraryTotals recommendedItinerary = plan.recommendedItinerary();
        double distanceKm = legs.stream().mapToDouble(Leg::greatCircleKm).sum();
        return new ComparisonResponse(
                tripId,
                departureDate,
                travelers,
                priority,
                oneDecimal(distanceKm),
                CURRENCY,
                weather.forecasts().stream().map(ComparisonMapper::toSummary).toList(),
                weather.status(),
                IntStream.range(0, legs.size())
                        .mapToObj(i -> toResponse(i, legs.get(i), plan.legUnavailable().get(i)))
                        .toList(),
                recommendedItinerary == null ? null : toResponse(recommendedItinerary),
                plan.singleModeTotals().stream().map(ComparisonMapper::toResponse).toList(),
                toResponses(plan.totalsUnavailable()));
    }

    private static LegResponse toResponse(int index, Leg leg, List<UnavailableGroup> unavailable) {
        return new LegResponse(
                index,
                leg.from(),
                leg.to(),
                oneDecimal(leg.greatCircleKm()),
                leg.options().stream().map(ComparisonMapper::toResponse).toList(),
                leg.recommended().map(ModeOption::mode).orElse(null),
                toResponses(unavailable));
    }

    private static List<UnavailableGroupResponse> toResponses(List<UnavailableGroup> groups) {
        return groups.stream()
                .map(group -> new UnavailableGroupResponse(group.code(), group.modes(), group.message()))
                .toList();
    }

    private static ItineraryTotalsResponse toResponse(ItineraryTotals totals) {
        return new ItineraryTotalsResponse(totals.modes(), totals.durationMinutes(), totals.totalCost(),
                totals.co2Kg());
    }

    private static ModeTotalsResponse toResponse(ModeTotals modeTotals) {
        ItineraryTotals totals = modeTotals.totals();
        return totals == null
                ? new ModeTotalsResponse(modeTotals.mode(), false, modeTotals.unavailableCode(),
                        modeTotals.unavailableReason(), null, null, null)
                : new ModeTotalsResponse(modeTotals.mode(), true, null, null, totals.durationMinutes(),
                        totals.totalCost(), totals.co2Kg());
    }

    private static WeatherSummary toSummary(LocationForecast locationForecast) {
        WeatherForecast forecast = locationForecast.forecast();
        return new WeatherSummary(
                locationForecast.location().name(),
                forecast.date(),
                forecast.description(),
                forecast.temperatureMinC(),
                forecast.temperatureMaxC(),
                forecast.precipitationProbabilityPercent(),
                forecast.windSpeedMaxKmh(),
                forecast.hazards());
    }

    private static ModeOptionResponse toResponse(ModeOption option) {
        return new ModeOptionResponse(
                option.mode(),
                option.available(),
                option.unavailableCode(),
                option.unavailableReason(),
                oneDecimal(option.routeKm()),
                option.durationMinutes(),
                option.totalCost(),
                option.co2Kg(),
                option.score(),
                option.recommended(),
                option.notes());
    }

    private static BigDecimal oneDecimal(double value) {
        return BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP);
    }
}
