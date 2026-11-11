package com.routewise.weather.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;

import com.routewise.weather.client.WeatherClient;
import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * Checks that the configured timeouts are really applied, against a local
 * JDK HTTP server (no external calls).
 */
class WeatherClientConfigTest {

    private static final LocalDate DATE = LocalDate.of(2026, 11, 20);
    private static final String BODY = """
            {"daily": {"time": ["2026-11-20"], "weather_code": [0]}}
            """;

    private HttpServer server;
    private volatile Duration responseDelay = Duration.ZERO;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/forecast", exchange -> {
            sleep(responseDelay);
            byte[] body = BODY.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void weatherClient_withFastServer_returnsForecast() {
        assertThat(client(Duration.ofSeconds(2)).fetchDailyForecast(52.52, 13.405, DATE)).isPresent();
    }

    @Test
    void weatherClient_whenServerIsSlowerThanReadTimeout_failsFast() {
        responseDelay = Duration.ofSeconds(3);
        WeatherClient client = client(Duration.ofMillis(300));

        long start = System.nanoTime();
        assertThatThrownBy(() -> client.fetchDailyForecast(52.52, 13.405, DATE))
                .isInstanceOf(ResourceAccessException.class);
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(2));
    }

    private WeatherClient client(Duration readTimeout) {
        WeatherProperties properties = new WeatherProperties(
                URI.create("http://127.0.0.1:" + server.getAddress().getPort()), Duration.ofSeconds(1), readTimeout);
        return new WeatherClientConfig().weatherClient(RestClient.builder(), properties);
    }

    private static void sleep(Duration duration) {
        try {
            Thread.sleep(duration);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }
}
