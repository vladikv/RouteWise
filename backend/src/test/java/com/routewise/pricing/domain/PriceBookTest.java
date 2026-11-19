package com.routewise.pricing.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.Map;

import com.routewise.transportmode.domain.TransportModeCode;

import org.junit.jupiter.api.Test;

class PriceBookTest {

    private static final Fare WEST_TRAIN = new Fare(new BigDecimal("5.00"), new BigDecimal("0.140"));
    private static final Fare EAST_TRAIN = new Fare(new BigDecimal("2.00"), new BigDecimal("0.060"));
    private static final Fare WEST_PLANE = new Fare(new BigDecimal("40.00"), new BigDecimal("0.070"));

    private final PriceBook book = new PriceBook(
            Map.of("DE", new CountryPrice("EUROPE_WEST", new BigDecimal("1.750"), new BigDecimal("0.000")),
                    "PL", new CountryPrice("EUROPE_EAST", new BigDecimal("1.450"), new BigDecimal("0.010"))),
            Map.of("EUROPE_WEST", Map.of(TransportModeCode.TRAIN, WEST_TRAIN, TransportModeCode.PLANE, WEST_PLANE),
                    "EUROPE_EAST", Map.of(TransportModeCode.TRAIN, EAST_TRAIN)));

    @Test
    void forLeg_withinOneCountry_usesItsPricesUnchanged() {
        LegPricing leg = book.forLeg("DE", "DE");

        // (1.75 + 1.75) / 2 = 1.75; the fares are the region's own
        assertThat(leg.fuelEurPerLitre()).isEqualByComparingTo("1.75");
        assertThat(leg.tollEurPerKm()).isEqualByComparingTo("0");
        assertThat(leg.fare(TransportModeCode.TRAIN)).contains(WEST_TRAIN);
        assertThat(leg.fare(TransportModeCode.BUS)).isEmpty();
    }

    @Test
    void forLeg_acrossRegions_averagesFuelTollAndFares() {
        LegPricing leg = book.forLeg("DE", "PL");

        // fuel (1.75 + 1.45) / 2 = 1.60; toll (0 + 0.01) / 2 = 0.005;
        // train base (5 + 2) / 2 = 3.50, per km (0.14 + 0.06) / 2 = 0.10; only Western Europe has a plane fare
        assertThat(leg.fuelEurPerLitre()).isEqualByComparingTo("1.60");
        assertThat(leg.tollEurPerKm()).isEqualByComparingTo("0.005");
        assertThat(leg.fare(TransportModeCode.TRAIN)).hasValueSatisfying(fare -> {
            assertThat(fare.baseFareEur()).isEqualByComparingTo("3.50");
            assertThat(fare.costPerKm()).isEqualByComparingTo("0.10");
        });
        assertThat(leg.fare(TransportModeCode.PLANE)).contains(WEST_PLANE);
    }

    @Test
    void forLeg_oneCountryUnknown_usesTheOtherCountrysPrices() {
        LegPricing leg = book.forLeg("XX", "PL");

        assertThat(leg.fuelEurPerLitre()).isEqualByComparingTo("1.45");
        assertThat(leg.fare(TransportModeCode.TRAIN)).contains(EAST_TRAIN);
    }

    @Test
    void legPricing_fuelWithoutToll_isRejected() {
        assertThatThrownBy(() -> new LegPricing(BigDecimal.ONE, null, Map.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void forLeg_bothCountriesUnknown_hasNoPrices() {
        assertThat(book.forLeg("XX", "YY")).isEqualTo(LegPricing.NONE);
        assertThat(PriceBook.EMPTY.forLeg("DE", "PL")).isEqualTo(LegPricing.NONE);
    }
}
