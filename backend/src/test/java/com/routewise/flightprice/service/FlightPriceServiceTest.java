package com.routewise.flightprice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.routewise.flightprice.client.FlightPriceClient;
import com.routewise.flightprice.config.FlightPriceProperties;
import com.routewise.flightprice.domain.AirportPair;
import com.routewise.flightprice.domain.LiveFare;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.web.client.ResourceAccessException;

class FlightPriceServiceTest {

    /** Today is 2026-11-20. */
    private static final Instant NOW = Instant.parse("2026-11-20T10:00:00Z");
    private static final LocalDate DATE = LocalDate.of(2026, 12, 1);
    private static final AirportPair LHR_KRK = new AirportPair("LHR", "KRK");
    private static final AirportPair KRK_WAW = new AirportPair("KRK", "WAW");
    private static final FlightPriceProperties PROPERTIES = new FlightPriceProperties("secret-key",
            URI.create("https://serpapi.test"), Duration.ofSeconds(2), Duration.ofSeconds(10), Duration.ofHours(6));

    private final FlightPriceClient client = mock(FlightPriceClient.class);
    private final MutableClock clock = new MutableClock(NOW);
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private final Logger serviceLog = (Logger) LoggerFactory.getLogger(FlightPriceService.class);

    @BeforeEach
    void captureLogs() {
        logs.start();
        serviceLog.addAppender(logs);
    }

    @AfterEach
    void releaseLogs() {
        serviceLog.detachAppender(logs);
    }

    @Test
    void cheapestFares_withoutClient_isEmpty() {
        FlightPriceService service = new FlightPriceService(provider(null), PROPERTIES, clock);

        assertThat(service.cheapestFares(List.of(LHR_KRK), DATE)).isEmpty();
    }

    @Test
    void cheapestFares_sameAirportPastDateOrTooFarAhead_isEmptyWithoutAsking() {
        FlightPriceService service = service();

        assertThat(service.cheapestFares(List.of(new AirportPair("AMS", "AMS")), DATE)).isEmpty();
        assertThat(service.cheapestFares(List.of(LHR_KRK), LocalDate.of(2026, 11, 19))).isEmpty();
        // 2026-11-20 + 330 days = 2027-10-16 is the last day asked.
        assertThat(service.cheapestFares(List.of(LHR_KRK), LocalDate.of(2027, 10, 17))).isEmpty();
        verifyNoInteractions(client);
    }

    @Test
    void cheapestFares_returnsEachFoundFareWithTheTimeItWasFetched_andLeavesOutRoutesWithout() {
        when(client.cheapestOneWayFare("LHR", "KRK", DATE)).thenReturn(Optional.of(new BigDecimal("89")));
        when(client.cheapestOneWayFare("KRK", "WAW", DATE)).thenReturn(Optional.empty());

        assertThat(service().cheapestFares(List.of(LHR_KRK, KRK_WAW), DATE))
                .containsExactly(Map.entry(LHR_KRK, new LiveFare(new BigDecimal("89"), NOW)));
    }

    @Test
    void cheapestFares_lastDaySold_isAsked() {
        LocalDate lastDay = LocalDate.of(2027, 10, 16);
        when(client.cheapestOneWayFare("LHR", "KRK", lastDay)).thenReturn(Optional.of(new BigDecimal("60")));

        assertThat(service().cheapestFares(List.of(LHR_KRK), lastDay)).containsKey(LHR_KRK);
    }

    @Test
    void cheapestFares_sameRouteTwiceInOneRequest_isAskedOnce() {
        when(client.cheapestOneWayFare("LHR", "KRK", DATE)).thenReturn(Optional.of(new BigDecimal("89")));

        service().cheapestFares(List.of(LHR_KRK, LHR_KRK), DATE);

        verify(client).cheapestOneWayFare("LHR", "KRK", DATE);
    }

    @Test
    void cheapestFares_cachedFare_keepsItsFirstFetchTime() {
        when(client.cheapestOneWayFare("LHR", "KRK", DATE)).thenReturn(Optional.of(new BigDecimal("89")));
        FlightPriceService service = service();

        service.cheapestFares(List.of(LHR_KRK), DATE);
        clock.advance(Duration.ofHours(1));
        Map<AirportPair, LiveFare> again = service.cheapestFares(List.of(LHR_KRK), DATE);

        verify(client).cheapestOneWayFare("LHR", "KRK", DATE);
        assertThat(again.get(LHR_KRK).retrievedAt()).isEqualTo(NOW);
    }

    @Test
    void cheapestFares_noFlightThatDay_isRemembered() {
        when(client.cheapestOneWayFare("KRK", "WAW", DATE)).thenReturn(Optional.empty());
        FlightPriceService service = service();

        service.cheapestFares(List.of(KRK_WAW), DATE);
        service.cheapestFares(List.of(KRK_WAW), DATE);

        verify(client).cheapestOneWayFare("KRK", "WAW", DATE);
    }

    @Test
    void cheapestFares_failure_isEmptyPausesLookupsForAMinuteAndIsNotCached() {
        when(client.cheapestOneWayFare("LHR", "KRK", DATE))
                .thenThrow(new ResourceAccessException("I/O error"))
                .thenReturn(Optional.of(new BigDecimal("95")));
        FlightPriceService service = service();

        assertThat(service.cheapestFares(List.of(LHR_KRK), DATE)).isEmpty();
        clock.advance(Duration.ofSeconds(59));
        assertThat(service.cheapestFares(List.of(LHR_KRK, KRK_WAW), DATE)).isEmpty();
        verify(client, times(1)).cheapestOneWayFare(anyString(), anyString(), any());

        clock.advance(Duration.ofSeconds(1));
        assertThat(service.cheapestFares(List.of(LHR_KRK), DATE).get(LHR_KRK).perTravelerEur())
                .isEqualByComparingTo("95");
    }

    @Test
    void cheapestFares_failure_logsOnlyTheErrorTypeNeverTheUrlWithTheKey() {
        when(client.cheapestOneWayFare("LHR", "KRK", DATE)).thenThrow(new ResourceAccessException(
                "I/O error on GET request for \"https://serpapi.com/search?api_key=secret-key\""));

        service().cheapestFares(List.of(LHR_KRK), DATE);

        assertThat(logs.list).singleElement().satisfies(event -> {
            assertThat(event.getFormattedMessage()).endsWith("ResourceAccessException");
            assertThat(event.getFormattedMessage()).doesNotContain("secret-key").doesNotContain("serpapi.com");
        });
    }

    @Test
    void cheapestFares_routesOfOneRequest_areAskedInParallel() throws InterruptedException {
        // Each call waits until both have started: sequential calls would wait for the latch until it times out.
        CountDownLatch bothStarted = new CountDownLatch(2);
        AtomicInteger calls = new AtomicInteger();
        when(client.cheapestOneWayFare(anyString(), anyString(), any())).thenAnswer(invocation -> {
            calls.incrementAndGet();
            bothStarted.countDown();
            return bothStarted.await(2, TimeUnit.SECONDS) ? Optional.of(BigDecimal.TEN) : Optional.empty();
        });

        Map<AirportPair, LiveFare> fares = service().cheapestFares(List.of(LHR_KRK, KRK_WAW), DATE);

        assertThat(calls).hasValue(2);
        assertThat(fares).containsOnlyKeys(LHR_KRK, KRK_WAW);
    }

    private FlightPriceService service() {
        return new FlightPriceService(provider(client), PROPERTIES, clock);
    }

    private static ObjectProvider<FlightPriceClient> provider(FlightPriceClient client) {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        if (client != null) {
            beans.addBean("flightPriceClient", client);
        }
        return beans.getBeanProvider(FlightPriceClient.class);
    }

    /** A clock the test moves forward, for the cache's fetch time and the pause after a failure. */
    private static final class MutableClock extends Clock {

        private volatile Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
