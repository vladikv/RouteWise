package com.routewise.comparison.mapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.WeatherSummary;
import com.routewise.transportmode.domain.TransportMode;
import com.routewise.trip.domain.Trip;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.domain.WeatherForecast;

import org.springframework.stereotype.Component;

@Component
public class ComparisonMapper {

    static final String CURRENCY = "EUR";

    public ModeParameters toParameters(TransportMode mode) {
        return new ModeParameters(mode.getCode(), mode.getAvgSpeedKmh(), mode.getCostPerKm(),
                mode.getCo2GramsPerKm(), mode.getFixedOverheadMinutes(), mode.getMaxDistanceKm());
    }

    public ComparisonResponse toResponse(Trip trip, double distanceKm, List<LocationForecast> forecasts,
                                         List<ModeOption> options) {
        return new ComparisonResponse(
                trip.getId(),
                trip.getDepartureDate(),
                trip.getTravelers(),
                trip.getPriority(),
                oneDecimal(distanceKm),
                CURRENCY,
                forecasts.stream().map(ComparisonMapper::toSummary).toList(),
                options.stream().map(ComparisonMapper::toResponse).toList());
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
