package com.routewise.comparison.service;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.domain.WeatherHazard;

/**
 * How weather changes a mode's score. The worst location counts, because the
 * traveler passes through both origin and destination.
 */
final class WeatherImpact {

    static final double BIKE_BAD_WEATHER_MULTIPLIER = 0.4;
    static final double ROAD_WINTER_MULTIPLIER = 0.9;

    private static final Set<WeatherHazard> BIKE_HAZARDS = EnumSet.allOf(WeatherHazard.class);
    private static final Set<WeatherHazard> ROAD_HAZARDS = EnumSet.of(WeatherHazard.SNOW, WeatherHazard.ICE);

    record Impact(double multiplier, List<String> notes) {
        static final Impact NONE = new Impact(1.0, List.of());
    }

    private WeatherImpact() {
    }

    static Impact assess(TransportModeCode mode, List<LocationForecast> forecasts) {
        return switch (mode) {
            case BIKE -> assess(forecasts, BIKE_HAZARDS, BIKE_BAD_WEATHER_MULTIPLIER, "cycling");
            case CAR, BUS -> assess(forecasts, ROAD_HAZARDS, ROAD_WINTER_MULTIPLIER, "road travel");
            case TRAIN, PLANE -> Impact.NONE;
        };
    }

    private static Impact assess(List<LocationForecast> forecasts, Set<WeatherHazard> relevant,
                                 double penalty, String activity) {
        double multiplier = 1.0;
        List<String> notes = new ArrayList<>();
        for (LocationForecast locationForecast : forecasts) {
            Set<WeatherHazard> hazards = EnumSet.noneOf(WeatherHazard.class);
            hazards.addAll(locationForecast.forecast().hazards());
            hazards.retainAll(relevant);
            if (!hazards.isEmpty()) {
                multiplier = Math.min(multiplier, penalty);
                notes.add("%s expected in %s, %s score reduced".formatted(
                        capitalize(labels(hazards)), locationForecast.location().name(), activity));
            }
        }
        return new Impact(multiplier, List.copyOf(notes));
    }

    private static String labels(Set<WeatherHazard> hazards) {
        return hazards.stream().map(WeatherHazard::label).collect(Collectors.joining(", "));
    }

    private static String capitalize(String text) {
        return Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }
}
