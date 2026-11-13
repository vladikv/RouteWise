package com.routewise.weather.config;

import java.net.URI;
import java.time.Duration;

import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Weather provider settings, bound from {@code routewise.weather.*}.
 * A missing base URL fails fast at startup with a clear binding error.
 *
 * @param cacheTtl how long a fetched forecast is reused for the same city and date
 */
@ConfigurationProperties("routewise.weather")
@Validated
public record WeatherProperties(
        @NotNull URI baseUrl,
        @DefaultValue("2s") Duration connectTimeout,
        @DefaultValue("3s") Duration readTimeout,
        @DefaultValue("1h") @NotNull Duration cacheTtl) {
}
