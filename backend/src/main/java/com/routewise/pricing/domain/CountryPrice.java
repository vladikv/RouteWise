package com.routewise.pricing.domain;

import java.math.BigDecimal;

/**
 * A country's prices as the cost rules need them; decoupled from the {@link CountryPricing} entity.
 *
 * @param region the fare region whose {@link Fare}s apply to tickets bought in this country
 */
public record CountryPrice(String region, BigDecimal fuelEurPerLitre, BigDecimal tollEurPerKm) {
}
