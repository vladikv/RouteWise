package com.routewise.flightprice.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;

import com.routewise.flightprice.client.FlightPriceClient;
import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * The client bean as wired by {@link FlightPriceClientConfig}: only with a key, with the configured
 * timeouts, retried once on a server error but not on a 4xx. Runs against a local JDK HTTP server.
 */
class FlightPriceClientConfigTest {

    private static final LocalDate DATE = LocalDate.of(2026, 12, 1);
    private static final String BODY = """
            {"best_flights": [{"price": 89}]}
            """;

    private HttpServer server;
    private final AtomicInteger requests = new AtomicInteger();
    /** Status codes to answer with, one per request; 200 once the queue is empty. */
    private final Queue<Integer> statuses = new ConcurrentLinkedQueue<>();
    private volatile Duration responseDelay = Duration.ZERO;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/search", exchange -> {
            requests.incrementAndGet();
            sleep(responseDelay);
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
    void withoutApiKey_noClientBean() {
        runner().withPropertyValues("routewise.flight-prices.api-key=")
                .run(context -> assertThat(context).doesNotHaveBean(FlightPriceClient.class));
    }

    @Test
    void withApiKey_clientReturnsTheFare() {
        run("2s", client -> {
            assertThat(client.cheapestOneWayFare("LHR", "KRK", DATE)).isPresent();
            assertThat(requests).hasValue(1);
        });
    }

    @Test
    void serverSlowerThanReadTimeout_failsFast() {
        responseDelay = Duration.ofSeconds(3);
        run("300ms", client -> {
            long start = System.nanoTime();
            assertThatThrownBy(() -> client.cheapestOneWayFare("LHR", "KRK", DATE))
                    .isInstanceOf(ResourceAccessException.class);
            // Two attempts (one retry) of about 300 ms each, far below the 3 s the server takes.
            assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(2));
        });
    }

    @Test
    void serverErrorOnce_isRetriedAndSucceeds() {
        statuses.add(503);
        run("2s", client -> {
            assertThat(client.cheapestOneWayFare("LHR", "KRK", DATE)).isPresent();
            assertThat(requests).hasValue(2);
        });
    }

    @Test
    void serverErrorTwice_failsAfterOneRetry() {
        statuses.add(503);
        statuses.add(503);
        run("2s", client -> {
            assertThatThrownBy(() -> client.cheapestOneWayFare("LHR", "KRK", DATE))
                    .isInstanceOf(HttpServerErrorException.class);
            assertThat(requests).hasValue(2);
        });
    }

    @Test
    void clientError_isNotRetried() {
        statuses.add(401);
        run("2s", client -> {
            assertThatThrownBy(() -> client.cheapestOneWayFare("LHR", "KRK", DATE))
                    .isInstanceOf(HttpClientErrorException.class);
            assertThat(requests).hasValue(1);
        });
    }

    private ApplicationContextRunner runner() {
        return new ApplicationContextRunner()
                .withUserConfiguration(FlightPriceClientConfig.class)
                .withBean(RestClient.Builder.class, RestClient::builder)
                .withPropertyValues("routewise.flight-prices.base-url=http://127.0.0.1:"
                        + server.getAddress().getPort());
    }

    private void run(String readTimeout, ClientCheck check) {
        runner().withPropertyValues("routewise.flight-prices.api-key=test-key",
                        "routewise.flight-prices.read-timeout=" + readTimeout)
                .run(context -> check.accept(context.getBean(FlightPriceClient.class)));
    }

    @FunctionalInterface
    private interface ClientCheck {
        void accept(FlightPriceClient client);
    }

    private static void sleep(Duration duration) {
        try {
            Thread.sleep(duration);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }
}
