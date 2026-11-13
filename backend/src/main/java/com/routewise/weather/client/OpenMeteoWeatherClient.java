package com.routewise.weather.client;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.routewise.weather.domain.WeatherForecast;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.resilience.annotation.Retryable;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * {@link WeatherClient} backed by the Open-Meteo forecast API (no API key).
 * Created in {@code WeatherClientConfig} with a base URL and timeouts.
 * <p>
 * Successful answers (including "no data for that date") are cached per city and date;
 * a failure is not cached, so the next request tries again. A failed call is retried
 * once after 200 ms, except for 4xx answers, which a retry would not change.
 */
public class OpenMeteoWeatherClient implements WeatherClient {

    /** Successful forecasts per city and date ({@link ForecastKey}); configured in {@code WeatherClientConfig}. */
    public static final String FORECAST_CACHE = "weather-forecasts";

    static final String DAILY_VARIABLES = "weather_code,temperature_2m_min,temperature_2m_max,"
            + "precipitation_probability_max,wind_speed_10m_max";

    private final RestClient restClient;

    public OpenMeteoWeatherClient(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    @Cacheable(cacheNames = FORECAST_CACHE,
            key = "T(com.routewise.weather.client.ForecastKey).of(#p0, #p1, #p2)")
    @Retryable(includes = RestClientException.class, excludes = HttpClientErrorException.class,
            maxRetries = 1, delay = 200)
    public Optional<WeatherForecast> fetchDailyForecast(double latitude, double longitude, LocalDate date) {
        OpenMeteoResponse response = restClient.get()
                .uri(uri -> uri.path("/v1/forecast")
                        .queryParam("latitude", latitude)
                        .queryParam("longitude", longitude)
                        .queryParam("daily", DAILY_VARIABLES)
                        .queryParam("timezone", "auto")
                        .queryParam("start_date", date)
                        .queryParam("end_date", date)
                        .build())
                .retrieve()
                .body(OpenMeteoResponse.class);
        return Optional.ofNullable(response)
                .map(OpenMeteoResponse::daily)
                .flatMap(daily -> toForecast(daily, date));
    }

    private static Optional<WeatherForecast> toForecast(OpenMeteoResponse.Daily daily, LocalDate date) {
        int index = daily.time() == null ? -1 : daily.time().indexOf(date);
        if (index < 0) {
            return Optional.empty();
        }
        return Optional.of(new WeatherForecast(
                date,
                valueAt(daily.weatherCode(), index),
                valueAt(daily.temperatureMin(), index),
                valueAt(daily.temperatureMax(), index),
                valueAt(daily.precipitationProbabilityMax(), index),
                valueAt(daily.windSpeedMax(), index)));
    }

    private static <T> T valueAt(List<T> values, int index) {
        return values != null && index < values.size() ? values.get(index) : null;
    }
}
