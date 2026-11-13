package com.routewise.weather.domain;

import java.util.List;

/**
 * The forecasts that could be fetched for a route and how complete they are.
 *
 * @param forecasts in the order of the requested locations; may be empty
 */
public record WeatherReport(WeatherStatus status, List<LocationForecast> forecasts) {
}
