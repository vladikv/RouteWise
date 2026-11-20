package com.routewise.flightprice.client;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

import org.springframework.resilience.annotation.Retryable;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * {@link FlightPriceClient} backed by SerpApi's Google Flights engine: one-way, economy, one adult, EUR.
 * Created in {@code FlightPriceClientConfig} only when an API key is set. A failed call is retried once
 * after 200 ms, except for 4xx answers (wrong key, exhausted quota), which a retry would not change.
 */
public class SerpApiFlightPriceClient implements FlightPriceClient {

    /**
     * Part of SerpApi's answer when Google Flights has no flight for the route and day ("Google Flights hasn't
     * returned any results for this query."); not a failure. Matched as a part, so small rewordings still count.
     */
    static final String NO_RESULTS_ERROR = "returned any results";

    private static final String ONE_WAY = "2";

    private final RestClient restClient;
    private final String apiKey;

    public SerpApiFlightPriceClient(RestClient restClient, String apiKey) {
        this.restClient = restClient;
        this.apiKey = apiKey;
    }

    @Override
    @Retryable(includes = RestClientException.class, excludes = HttpClientErrorException.class,
            maxRetries = 1, delay = 200)
    public Optional<BigDecimal> cheapestOneWayFare(String fromAirport, String toAirport, LocalDate date) {
        SerpApiFlightsResponse response = restClient.get()
                .uri(uri -> uri.path("/search")
                        .queryParam("engine", "google_flights")
                        .queryParam("type", ONE_WAY)
                        .queryParam("departure_id", fromAirport)
                        .queryParam("arrival_id", toAirport)
                        .queryParam("outbound_date", date)
                        .queryParam("adults", 1)
                        .queryParam("travel_class", 1)
                        .queryParam("currency", "EUR")
                        .queryParam("hl", "en")
                        .queryParam("api_key", apiKey)
                        .build())
                .retrieve()
                .body(SerpApiFlightsResponse.class);
        if (response == null) {
            throw new FlightPriceClientException("Empty answer from SerpApi");
        }
        Optional<BigDecimal> cheapest = Stream.of(response.bestFlights(), response.otherFlights())
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .map(SerpApiFlightsResponse.Itinerary::price)
                .filter(Objects::nonNull)
                .min(Integer::compare)
                .map(BigDecimal::valueOf);
        if (cheapest.isEmpty() && response.error() != null && !response.error().contains(NO_RESULTS_ERROR)) {
            throw new FlightPriceClientException("SerpApi error: " + response.error());
        }
        return cheapest;
    }
}
