package com.routewise.weather.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class WeatherForecastTest {

    private static final LocalDate DATE = LocalDate.of(2026, 11, 20);

    @Test
    void hazards_clearMildDay_isEmpty() {
        assertThat(forecast(0, 8.0, 15.0, 10, 12.0).hazards()).isEmpty();
    }

    @Test
    void hazards_rainCode_isRain() {
        assertThat(forecast(63, 5.0, 10.0, 90, 15.0).hazards()).containsExactly(WeatherHazard.RAIN);
    }

    @Test
    void hazards_highPrecipitationProbabilityWithoutPrecipitationCode_isRain() {
        assertThat(forecast(3, 5.0, 10.0, 60, 15.0).hazards()).containsExactly(WeatherHazard.RAIN);
    }

    @Test
    void hazards_snowBelowZero_isSnowFreezingAndIce() {
        assertThat(forecast(73, -4.0, 1.0, 80, 10.0).hazards())
                .containsExactlyInAnyOrder(WeatherHazard.SNOW, WeatherHazard.FREEZING, WeatherHazard.ICE);
    }

    @Test
    void hazards_thunderstormAndStrongWind() {
        assertThat(forecast(95, 15.0, 25.0, 70, 45.0).hazards())
                .containsExactlyInAnyOrder(WeatherHazard.THUNDERSTORM, WeatherHazard.STRONG_WIND);
    }

    @Test
    void hazards_missingValues_areIgnored() {
        assertThat(new WeatherForecast(DATE, null, null, null, null, null).hazards()).isEmpty();
    }

    @Test
    void description_mapsWmoCodes() {
        assertThat(forecast(0, 0.0, 0.0, 0, 0.0).description()).isEqualTo("Clear sky");
        assertThat(forecast(1, 0.0, 0.0, 0, 0.0).description()).isEqualTo("Mainly clear");
        assertThat(forecast(2, 0.0, 0.0, 0, 0.0).description()).isEqualTo("Partly cloudy");
        assertThat(forecast(3, 0.0, 0.0, 0, 0.0).description()).isEqualTo("Overcast");
        assertThat(forecast(81, 0.0, 0.0, 0, 0.0).description()).isEqualTo("Rain showers");
        assertThat(forecast(42, 0.0, 0.0, 0, 0.0).description()).isEqualTo("Unknown");
    }

    private static WeatherForecast forecast(Integer code, Double min, Double max, Integer precipitation,
                                            Double wind) {
        return new WeatherForecast(DATE, code, min, max, precipitation, wind);
    }
}
