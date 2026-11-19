package com.routewise.pricing.domain;

import java.math.BigDecimal;

/**
 * A ticket price per traveler: {@code baseFareEur + costPerKm × km}.
 */
public record Fare(BigDecimal baseFareEur, BigDecimal costPerKm) {
}
