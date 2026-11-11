package com.routewise.weather.client;

import java.time.LocalDate;
import java.util.Optional;

import com.routewise.weather.domain.WeatherForecast;

/**
 * Fetches a daily forecast from an external provider. Implementations may
 * throw {@link org.springframework.web.client.RestClientException} on
 * network errors or timeouts; callers decide how to degrade.
 */
public interface WeatherClient {

    Optional<WeatherForecast> fetchDailyForecast(double latitude, double longitude, LocalDate date);
}
