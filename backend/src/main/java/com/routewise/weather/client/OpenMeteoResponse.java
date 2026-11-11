package com.routewise.weather.client;

import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Subset of the Open-Meteo {@code /v1/forecast} response with {@code daily} variables.
 */
record OpenMeteoResponse(Daily daily) {

    record Daily(
            List<LocalDate> time,
            @JsonProperty("weather_code") List<Integer> weatherCode,
            @JsonProperty("temperature_2m_min") List<Double> temperatureMin,
            @JsonProperty("temperature_2m_max") List<Double> temperatureMax,
            @JsonProperty("precipitation_probability_max") List<Integer> precipitationProbabilityMax,
            @JsonProperty("wind_speed_10m_max") List<Double> windSpeedMax) {
    }
}
