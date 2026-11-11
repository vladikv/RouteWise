package com.routewise.weather.domain;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.Set;

/**
 * Daily forecast for one location. Numeric values are nullable because
 * the provider may omit them.
 *
 * @param weatherCode WMO weather interpretation code (0–99)
 */
public record WeatherForecast(
        LocalDate date,
        Integer weatherCode,
        Double temperatureMinC,
        Double temperatureMaxC,
        Integer precipitationProbabilityPercent,
        Double windSpeedMaxKmh) {

    static final int LIKELY_PRECIPITATION_PERCENT = 60;
    static final double STRONG_WIND_KMH = 40;
    static final double FREEZING_MAX_C = 3;

    public Set<WeatherHazard> hazards() {
        Set<WeatherHazard> hazards = EnumSet.noneOf(WeatherHazard.class);
        int code = weatherCode == null ? -1 : weatherCode;
        if (isBetween(code, 51, 67) || isBetween(code, 80, 82)) {
            hazards.add(WeatherHazard.RAIN);
        }
        if (isBetween(code, 71, 77) || isBetween(code, 85, 86)) {
            hazards.add(WeatherHazard.SNOW);
        }
        if (isBetween(code, 95, 99)) {
            hazards.add(WeatherHazard.THUNDERSTORM);
        }
        // A high precipitation probability without a precipitation code counts as rain,
        // even below zero (then also ICE); the code is the better signal for snow.
        boolean precipitationFromCode = !hazards.isEmpty();
        if (!precipitationFromCode && precipitationProbabilityPercent != null
                && precipitationProbabilityPercent >= LIKELY_PRECIPITATION_PERCENT) {
            hazards.add(WeatherHazard.RAIN);
        }
        if (windSpeedMaxKmh != null && windSpeedMaxKmh >= STRONG_WIND_KMH) {
            hazards.add(WeatherHazard.STRONG_WIND);
        }
        if (temperatureMaxC != null && temperatureMaxC < FREEZING_MAX_C) {
            hazards.add(WeatherHazard.FREEZING);
        }
        boolean wet = hazards.contains(WeatherHazard.RAIN) || hazards.contains(WeatherHazard.SNOW);
        if (wet && temperatureMinC != null && temperatureMinC <= 0) {
            hazards.add(WeatherHazard.ICE);
        }
        return hazards;
    }

    /**
     * Short human-readable summary of the WMO weather code.
     */
    public String description() {
        if (weatherCode == null) {
            return "Unknown";
        }
        int code = weatherCode;
        if (code == 0) {
            return "Clear sky";
        }
        if (code == 1) {
            return "Mainly clear";
        }
        if (code == 2) {
            return "Partly cloudy";
        }
        if (code == 3) {
            return "Overcast";
        }
        if (code == 45 || code == 48) {
            return "Fog";
        }
        if (isBetween(code, 51, 57)) {
            return "Drizzle";
        }
        if (isBetween(code, 61, 67)) {
            return "Rain";
        }
        if (isBetween(code, 71, 77)) {
            return "Snow";
        }
        if (isBetween(code, 80, 82)) {
            return "Rain showers";
        }
        if (isBetween(code, 85, 86)) {
            return "Snow showers";
        }
        if (isBetween(code, 95, 99)) {
            return "Thunderstorm";
        }
        return "Unknown";
    }

    private static boolean isBetween(int value, int from, int to) {
        return value >= from && value <= to;
    }
}
