package com.routewise.pricing.domain;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import com.routewise.flightprice.domain.LiveFare;
import com.routewise.transportmode.domain.TransportModeCode;

/**
 * The prices that apply to one leg, averaged over its two countries (see {@link PriceBook#forLeg}).
 *
 * @param fuelEurPerLitre {@code null} when neither country has a price; the car then uses its per-km fallback
 * @param tollEurPerKm    {@code null} exactly when {@code fuelEurPerLitre} is
 * @param fares           per ticket mode (TRAIN, BUS, PLANE); a missing mode uses its per-km fallback
 * @param livePlaneFare   the cheapest live flight for the leg and date; {@code null} = the plane uses its fare
 */
public record LegPricing(BigDecimal fuelEurPerLitre, BigDecimal tollEurPerKm, Map<TransportModeCode, Fare> fares,
                         LiveFare livePlaneFare) {

    /** No regional prices: every mode uses its per-km fallback. */
    public static final LegPricing NONE = new LegPricing(null, null, Map.of());

    public LegPricing {
        if ((fuelEurPerLitre == null) != (tollEurPerKm == null)) {
            throw new IllegalArgumentException("fuel price and toll must both be set or both be null");
        }
        fares = Map.copyOf(Objects.requireNonNull(fares, "fares"));
    }

    /** Seeded prices only, no live fare. */
    public LegPricing(BigDecimal fuelEurPerLitre, BigDecimal tollEurPerKm, Map<TransportModeCode, Fare> fares) {
        this(fuelEurPerLitre, tollEurPerKm, fares, null);
    }

    /** The same prices with a live plane fare; an empty fare keeps the seeded one. */
    public LegPricing withLivePlaneFare(Optional<LiveFare> fare) {
        return fare.map(live -> new LegPricing(fuelEurPerLitre, tollEurPerKm, fares, live)).orElse(this);
    }

    public Optional<Fare> fare(TransportModeCode mode) {
        return Optional.ofNullable(fares.get(mode));
    }
}
