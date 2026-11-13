package com.routewise.weather.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

import com.routewise.weather.client.WeatherClient;
import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestClient;

/**
 * The weather client bean as wired by {@link WeatherClientConfig}: cached per city and date,
 * retried once on failure. Runs against a local JDK HTTP server that counts requests.
 */
class WeatherClientResilienceTest {

    private static final LocalDate DATE = LocalDate.of(2026, 11, 20);
    private static final String BODY = """
            {"daily": {"time": ["2026-11-20", "2026-11-21"], "weather_code": [0, 61]}}
            """;

    private HttpServer server;
    private final AtomicInteger requests = new AtomicInteger();
    /** Status codes to answer with, one per request; 200 once the queue is empty. */
    private final Queue<Integer> statuses = new ConcurrentLinkedQueue<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/forecast", exchange -> {
            requests.incrementAndGet();
            int status = statuses.isEmpty() ? 200 : statuses.poll();
            byte[] body = (status == 200 ? BODY : "{}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, body.length);
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
    void sameCityAndDate_secondCallIsACacheHit() {
        run(client -> {
            assertThat(client.fetchDailyForecast(52.52, 13.405, DATE)).isPresent();
            assertThat(client.fetchDailyForecast(52.52, 13.405, DATE)).isPresent();

            assertThat(requests).hasValue(1);
        });
    }

    @Test
    void anotherDateOrCity_isACacheMiss() {
        run(client -> {
            client.fetchDailyForecast(52.52, 13.405, DATE);
            client.fetchDailyForecast(52.52, 13.405, DATE.plusDays(1));
            client.fetchDailyForecast(48.2082, 16.3738, DATE);

            assertThat(requests).hasValue(3);
        });
    }

    @Test
    void serverErrorOnce_isRetriedAndSucceeds() {
        statuses.add(503);
        run(client -> {
            assertThat(client.fetchDailyForecast(52.52, 13.405, DATE)).isPresent();

            assertThat(requests).hasValue(2);
        });
    }

    @Test
    void serverErrorTwice_failsAfterOneRetry_andTheFailureIsNotCached() {
        statuses.add(503);
        statuses.add(503);
        run(client -> {
            assertThatThrownBy(() -> client.fetchDailyForecast(52.52, 13.405, DATE))
                    .isInstanceOf(HttpServerErrorException.class);
            assertThat(requests).hasValue(2);

            assertThat(client.fetchDailyForecast(52.52, 13.405, DATE)).isPresent();
            assertThat(requests).hasValue(3);
        });
    }

    @Test
    void clientError_isNotRetried() {
        statuses.add(400);
        run(client -> {
            assertThatThrownBy(() -> client.fetchDailyForecast(52.52, 13.405, DATE))
                    .isInstanceOf(HttpClientErrorException.class);

            assertThat(requests).hasValue(1);
        });
    }

    private void run(Consumer<WeatherClient> test) {
        new ApplicationContextRunner()
                .withUserConfiguration(WeatherClientConfig.class)
                .withBean(RestClient.Builder.class, RestClient::builder)
                .withPropertyValues("routewise.weather.base-url=http://127.0.0.1:" + server.getAddress().getPort())
                .run(context -> test.accept(context.getBean(WeatherClient.class)));
    }
}
