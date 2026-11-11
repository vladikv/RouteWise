package com.routewise.weather.client;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.routewise.weather.domain.WeatherForecast;

import org.springframework.web.client.RestClient;

/**
 * {@link WeatherClient} backed by the Open-Meteo forecast API (no API key).
 * Created in {@code WeatherClientConfig} with a base URL and timeouts.
 */
public class OpenMeteoWeatherClient implements WeatherClient {

    static final String DAILY_VARIABLES = "weather_code,temperature_2m_min,temperature_2m_max,"
            + "precipitation_probability_max,wind_speed_10m_max";

    private final RestClient restClient;

    public OpenMeteoWeatherClient(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
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
