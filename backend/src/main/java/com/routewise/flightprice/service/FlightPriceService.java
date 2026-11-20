package com.routewise.flightprice.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.routewise.flightprice.client.FlightPriceClient;
import com.routewise.flightprice.config.FlightPriceProperties;
import com.routewise.flightprice.domain.AirportPair;
import com.routewise.flightprice.domain.LiveFare;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Best-effort live flight prices, never a reason for a comparison to fail:
 * <ul>
 *   <li>nothing is asked without an API key, for a date outside what Google Flights sells (today to
 *       {@value #MAX_DAYS_AHEAD} days ahead) or between cities sharing an airport;</li>
 *   <li>the routes of one request are asked in parallel (virtual threads), each at most once;</li>
 *   <li>answers, including "no flight that day", are kept per airports and date for
 *       {@code routewise.flight-prices.cache-ttl}; concurrent requests for the same key share one call;</li>
 *   <li>a failure is not cached, but pauses all lookups for {@link #PAUSE_AFTER_FAILURE}, so an outage or an
 *       exhausted quota costs one slow call a minute instead of one per leg and request.</li>
 * </ul>
 */
@Service
public class FlightPriceService {

    /** Google Flights sells flights up to about eleven months ahead. */
    static final long MAX_DAYS_AHEAD = 330;
    static final Duration PAUSE_AFTER_FAILURE = Duration.ofMinutes(1);
    /** Upper bound of cached answers; a few thousand routes and dates are plenty for one instance. */
    static final long CACHE_MAX_ENTRIES = 5_000;

    private static final Logger log = LoggerFactory.getLogger(FlightPriceService.class);

    private final FlightPriceClient client;
    private final Clock clock;
    private final Cache<RouteDate, Optional<LiveFare>> cache;
    private volatile Instant pausedUntil = Instant.MIN;

    public FlightPriceService(ObjectProvider<FlightPriceClient> client, FlightPriceProperties properties,
                              Clock clock) {
        this.client = client.getIfAvailable();
        this.clock = clock;
        this.cache = Caffeine.newBuilder()
                .expireAfterWrite(properties.cacheTtl())
                .maximumSize(CACHE_MAX_ENTRIES)
                .build();
    }

    /** The cheapest fare per route that has one; routes without a fare are left out. */
    public Map<AirportPair, LiveFare> cheapestFares(Collection<AirportPair> routes, LocalDate date) {
        List<AirportPair> wanted = routes.stream().filter(route -> !route.isSameAirport()).distinct().toList();
        if (client == null || wanted.isEmpty() || !isSold(date)) {
            return Map.of();
        }
        Map<AirportPair, LiveFare> fares = new LinkedHashMap<>();
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Map<AirportPair, Future<Optional<LiveFare>>> futures = new LinkedHashMap<>();
            wanted.forEach(route -> futures.put(route, executor.submit(() -> cheapestFare(route, date))));
            futures.forEach((route, future) -> await(future).ifPresent(fare -> fares.put(route, fare)));
        }
        return fares;
    }

    private boolean isSold(LocalDate date) {
        LocalDate today = LocalDate.now(clock);
        return !date.isBefore(today) && !date.isAfter(today.plusDays(MAX_DAYS_AHEAD));
    }

    private Optional<LiveFare> cheapestFare(AirportPair route, LocalDate date) {
        if (clock.instant().isBefore(pausedUntil)) {
            return Optional.empty();
        }
        try {
            return cache.get(new RouteDate(route, date), key -> client
                    .cheapestOneWayFare(route.fromAirport(), route.toAirport(), date)
                    .map(price -> new LiveFare(price, clock.instant())));
        } catch (RuntimeException ex) {
            pausedUntil = clock.instant().plus(PAUSE_AFTER_FAILURE);
            // Only the type: a RestClient message can contain the request URL, and with it the API key.
            log.warn("Live flight price {}-{} on {} unavailable, using the estimate; lookups paused for {}: {}",
                    route.fromAirport(), route.toAirport(), date, PAUSE_AFTER_FAILURE,
                    ex.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private static Optional<LiveFare> await(Future<Optional<LiveFare>> future) {
        try {
            return future.get();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (ExecutionException ex) {
            log.warn("Live flight price lookup failed unexpectedly: {}", ex.getCause().getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private record RouteDate(AirportPair route, LocalDate date) {
    }
}
