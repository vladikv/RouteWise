package com.routewise.trip.config;

import java.time.Duration;

import jakarta.validation.constraints.NotNull;

import org.hibernate.validator.constraints.time.DurationMin;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Trip settings, bound from {@code routewise.trips.*}.
 *
 * @param restoreWindow how long after a delete the trip can still be restored
 */
@Validated
@ConfigurationProperties("routewise.trips")
public record TripProperties(@DefaultValue("30s") @NotNull @DurationMin(seconds = 1) Duration restoreWindow) {
}
