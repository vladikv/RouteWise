package com.routewise.comparison.dto;

import java.time.LocalDate;
import java.util.Set;

import com.routewise.weather.domain.WeatherHazard;

public record WeatherSummary(
        String city,
        LocalDate date,
        String description,
        Double temperatureMinC,
        Double temperatureMaxC,
        Integer precipitationProbabilityPercent,
        Double windSpeedMaxKmh,
        Set<WeatherHazard> hazards) {
}
