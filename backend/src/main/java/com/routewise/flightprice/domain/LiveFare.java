package com.routewise.flightprice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

/**
 * The cheapest one-way flight a provider offered for one traveler on a leg and date.
 *
 * @param perTravelerEur price for one adult, in EUR
 * @param retrievedAt    when the provider was asked (a cached fare keeps its original time)
 */
public record LiveFare(BigDecimal perTravelerEur, Instant retrievedAt) {

    public LiveFare {
        Objects.requireNonNull(perTravelerEur, "perTravelerEur");
        Objects.requireNonNull(retrievedAt, "retrievedAt");
    }
}
