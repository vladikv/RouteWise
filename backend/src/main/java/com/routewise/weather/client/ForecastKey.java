package com.routewise.weather.client;

import java.time.LocalDate;

/**
 * Cache key of a daily forecast: the coordinates rounded to 4 decimals (about 11 m) and the date,
 * so the same city and day always hit the same entry.
 */
public record ForecastKey(long latitudeE4, long longitudeE4, LocalDate date) {

    public static ForecastKey of(double latitude, double longitude, LocalDate date) {
        return new ForecastKey(Math.round(latitude * 10_000), Math.round(longitude * 10_000), date);
    }
}
