package com.routewise.weather.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import com.routewise.weather.client.WeatherClient;
import com.routewise.weather.domain.Location;
import com.routewise.weather.domain.LocationForecast;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

/**
 * Best-effort forecasts: dates outside the provider's window and provider
 * failures yield no forecast instead of an error, so callers always work.
 */
@Service
public class WeatherService {

    /** Open-Meteo forecasts today plus 15 days (16 in total). */
    static final int FORECAST_DAYS_AHEAD = 15;

    private static final Logger log = LoggerFactory.getLogger(WeatherService.class);

    private final WeatherClient weatherClient;
    private final Clock clock;

    public WeatherService(WeatherClient weatherClient, Clock clock) {
        this.weatherClient = weatherClient;
        this.clock = clock;
    }

    /**
     * Fetches forecasts for all locations in parallel. Locations without a
     * forecast are left out; the result keeps the input order.
     */
    public List<LocationForecast> forecasts(List<Location> locations, LocalDate date) {
        if (!isWithinForecastWindow(date)) {
            return List.of();
        }
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<Optional<LocationForecast>>> futures = locations.stream()
                    .map(location -> executor.submit(() -> forecast(location, date)))
                    .toList();
            return futures.stream()
                    .map(WeatherService::await)
                    .flatMap(Optional::stream)
                    .toList();
        }
    }

    /**
     * Uses the server's "today"; Open-Meteo uses each location's time zone
     * ({@code timezone=auto}). On the window's edge days the provider may have
     * no data for the date, which simply yields no forecast.
     */
    boolean isWithinForecastWindow(LocalDate date) {
        LocalDate today = LocalDate.now(clock);
        return !date.isBefore(today) && !date.isAfter(today.plusDays(FORECAST_DAYS_AHEAD));
    }

    private Optional<LocationForecast> forecast(Location location, LocalDate date) {
        try {
            return weatherClient.fetchDailyForecast(location.latitude(), location.longitude(), date)
                    .map(forecast -> new LocationForecast(location, forecast));
        } catch (RestClientException ex) {
            log.warn("Weather forecast unavailable for {} on {}: {}", location.name(), date, ex.getMessage());
            return Optional.empty();
        }
    }

    private static Optional<LocationForecast> await(Future<Optional<LocationForecast>> future) {
        try {
            return future.get();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (ExecutionException ex) {
            log.warn("Weather forecast failed unexpectedly", ex.getCause());
            return Optional.empty();
        }
    }
}
