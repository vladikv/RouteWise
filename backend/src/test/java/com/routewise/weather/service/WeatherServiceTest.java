package com.routewise.weather.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import com.routewise.weather.client.WeatherClient;
import com.routewise.weather.domain.Location;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.domain.WeatherForecast;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.ResourceAccessException;

@ExtendWith(MockitoExtension.class)
class WeatherServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 11);
    private static final Clock CLOCK = Clock.fixed(TODAY.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC);
    private static final Location BERLIN = new Location("Berlin", 52.52, 13.405);
    private static final Location VIENNA = new Location("Vienna", 48.2082, 16.3738);

    @Mock
    private WeatherClient weatherClient;

    private WeatherService weatherService;

    @BeforeEach
    void setUp() {
        weatherService = new WeatherService(weatherClient, CLOCK);
    }

    @Test
    void forecasts_returnsOneForecastPerLocationInInputOrder() {
        LocalDate date = TODAY.plusDays(3);
        when(weatherClient.fetchDailyForecast(eq(52.52), anyDouble(), eq(date))).thenReturn(Optional.of(forecast(date, 0)));
        when(weatherClient.fetchDailyForecast(eq(48.2082), anyDouble(), eq(date))).thenReturn(Optional.of(forecast(date, 61)));

        List<LocationForecast> forecasts = weatherService.forecasts(List.of(BERLIN, VIENNA), date);

        assertThat(forecasts).extracting(forecast -> forecast.location().name()).containsExactly("Berlin", "Vienna");
        assertThat(forecasts.get(1).forecast().weatherCode()).isEqualTo(61);
    }

    @Test
    void forecasts_whenOneProviderCallFails_returnsTheOthers() {
        LocalDate date = TODAY.plusDays(3);
        when(weatherClient.fetchDailyForecast(eq(52.52), anyDouble(), eq(date)))
                .thenThrow(new ResourceAccessException("Read timed out"));
        when(weatherClient.fetchDailyForecast(eq(48.2082), anyDouble(), eq(date))).thenReturn(Optional.of(forecast(date, 0)));

        assertThat(weatherService.forecasts(List.of(BERLIN, VIENNA), date))
                .extracting(forecast -> forecast.location().name()).containsExactly("Vienna");
    }

    @Test
    void forecasts_whenClientThrowsUnexpectedException_returnsEmptyWithoutPropagating() {
        LocalDate date = TODAY.plusDays(3);
        when(weatherClient.fetchDailyForecast(anyDouble(), anyDouble(), eq(date)))
                .thenThrow(new IllegalStateException("unexpected"));

        assertThat(weatherService.forecasts(List.of(BERLIN, VIENNA), date)).isEmpty();
    }

    @Test
    void forecasts_whenProviderHasNoData_returnsEmpty() {
        LocalDate date = TODAY.plusDays(3);
        when(weatherClient.fetchDailyForecast(anyDouble(), anyDouble(), eq(date))).thenReturn(Optional.empty());

        assertThat(weatherService.forecasts(List.of(BERLIN), date)).isEmpty();
    }

    @Test
    void forecasts_outsideForecastWindow_doesNotCallProvider() {
        assertThat(weatherService.forecasts(List.of(BERLIN), TODAY.plusDays(16))).isEmpty();
        assertThat(weatherService.forecasts(List.of(BERLIN), TODAY.minusDays(1))).isEmpty();
        verifyNoInteractions(weatherClient);
    }

    @Test
    void isWithinForecastWindow_coversTodayToFifteenDaysAhead() {
        assertThat(weatherService.isWithinForecastWindow(TODAY)).isTrue();
        assertThat(weatherService.isWithinForecastWindow(TODAY.plusDays(15))).isTrue();
        assertThat(weatherService.isWithinForecastWindow(TODAY.plusDays(16))).isFalse();
        assertThat(weatherService.isWithinForecastWindow(TODAY.minusDays(1))).isFalse();
    }

    private static WeatherForecast forecast(LocalDate date, int weatherCode) {
        return new WeatherForecast(date, weatherCode, 5.0, 12.0, 10, 15.0);
    }
}
