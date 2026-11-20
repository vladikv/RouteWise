package com.routewise.flightprice.client;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

/**
 * Asks a flight search provider for the cheapest one-way fare. Implementations throw a
 * {@link org.springframework.web.client.RestClientException} or a {@link FlightPriceClientException}
 * on failure; {@code FlightPriceService} decides how to degrade.
 */
public interface FlightPriceClient {

    /**
     * @param fromAirport IATA code of the departure airport
     * @param toAirport   IATA code of the arrival airport
     * @return the price for one adult in EUR; empty when the provider has no flight for that day
     */
    Optional<BigDecimal> cheapestOneWayFare(String fromAirport, String toAirport, LocalDate date);
}
