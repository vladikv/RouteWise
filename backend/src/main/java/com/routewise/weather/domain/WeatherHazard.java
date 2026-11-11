package com.routewise.weather.domain;

/**
 * Travel-relevant weather conditions derived from a daily forecast.
 */
public enum WeatherHazard {
    RAIN("rain"),
    SNOW("snow"),
    THUNDERSTORM("thunderstorms"),
    STRONG_WIND("strong wind"),
    FREEZING("freezing temperatures"),
    ICE("icy roads");

    private final String label;

    WeatherHazard(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
