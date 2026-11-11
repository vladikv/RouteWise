package com.routewise.weather.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.SocketTimeoutException;
import java.time.LocalDate;

import com.routewise.weather.domain.WeatherForecast;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

class OpenMeteoWeatherClientTest {

    private static final LocalDate DATE = LocalDate.of(2026, 11, 20);

    private MockRestServiceServer server;
    private OpenMeteoWeatherClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://weather.test");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new OpenMeteoWeatherClient(builder.build());
    }

    @Test
    void fetchDailyForecast_requestsDailyVariablesAndParsesResponse() {
        server.expect(requestTo(Matchers.startsWith("https://weather.test/v1/forecast")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("latitude", "52.52"))
                .andExpect(queryParam("longitude", "13.405"))
                .andExpect(queryParam("start_date", "2026-11-20"))
                .andExpect(queryParam("end_date", "2026-11-20"))
                .andExpect(queryParam("daily", OpenMeteoWeatherClient.DAILY_VARIABLES))
                .andRespond(withSuccess("""
                        {"latitude": 52.52, "daily": {
                          "time": ["2026-11-20"],
                          "weather_code": [61],
                          "temperature_2m_min": [2.5],
                          "temperature_2m_max": [7.9],
                          "precipitation_probability_max": [85],
                          "wind_speed_10m_max": [24.1]}}
                        """, MediaType.APPLICATION_JSON));

        assertThat(client.fetchDailyForecast(52.52, 13.405, DATE))
                .contains(new WeatherForecast(DATE, 61, 2.5, 7.9, 85, 24.1));
        server.verify();
    }

    @Test
    void fetchDailyForecast_withNullValues_keepsThemNull() {
        server.expect(requestTo(Matchers.startsWith("https://weather.test/v1/forecast")))
                .andRespond(withSuccess("""
                        {"daily": {"time": ["2026-11-20"], "weather_code": [null],
                          "temperature_2m_min": [null], "temperature_2m_max": [null],
                          "precipitation_probability_max": [null], "wind_speed_10m_max": [null]}}
                        """, MediaType.APPLICATION_JSON));

        assertThat(client.fetchDailyForecast(52.52, 13.405, DATE))
                .contains(new WeatherForecast(DATE, null, null, null, null, null));
    }

    @Test
    void fetchDailyForecast_whenDateMissingFromResponse_returnsEmpty() {
        server.expect(requestTo(Matchers.startsWith("https://weather.test/v1/forecast")))
                .andRespond(withSuccess("""
                        {"daily": {"time": ["2026-11-21"], "weather_code": [0]}}
                        """, MediaType.APPLICATION_JSON));

        assertThat(client.fetchDailyForecast(52.52, 13.405, DATE)).isEmpty();
    }

    @Test
    void fetchDailyForecast_onServerError_throws() {
        server.expect(requestTo(Matchers.startsWith("https://weather.test/v1/forecast")))
                .andRespond(withServerError());

        assertThatThrownBy(() -> client.fetchDailyForecast(52.52, 13.405, DATE))
                .isInstanceOf(HttpServerErrorException.class);
    }

    @Test
    void fetchDailyForecast_onTimeout_throwsResourceAccessException() {
        server.expect(requestTo(Matchers.startsWith("https://weather.test/v1/forecast")))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));

        assertThatThrownBy(() -> client.fetchDailyForecast(52.52, 13.405, DATE))
                .isInstanceOf(ResourceAccessException.class);
    }
}
