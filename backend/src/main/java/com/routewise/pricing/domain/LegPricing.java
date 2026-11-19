package com.routewise.pricing.domain;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * The prices that apply to one leg, averaged over its two countries (see {@link PriceBook#forLeg}).
 *
 * @param fuelEurPerLitre {@code null} when neither country has a price; the car then uses its per-km fallback
 * @param tollEurPerKm    {@code null} exactly when {@code fuelEurPerLitre} is
 * @param fares           per ticket mode (TRAIN, BUS, PLANE); a missing mode uses its per-km fallback
 */
public record LegPricing(BigDecimal fuelEurPerLitre, BigDecimal tollEurPerKm, Map<TransportModeCode, Fare> fares) {

    /** No regional prices: every mode uses its per-km fallback. */
    public static final LegPricing NONE = new LegPricing(null, null, Map.of());

    public LegPricing {
        if ((fuelEurPerLitre == null) != (tollEurPerKm == null)) {
            throw new IllegalArgumentException("fuel price and toll must both be set or both be null");
        }
        fares = Map.copyOf(Objects.requireNonNull(fares, "fares"));
    }

    public Optional<Fare> fare(TransportModeCode mode) {
        return Optional.ofNullable(fares.get(mode));
    }
}
