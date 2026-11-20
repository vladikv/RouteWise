package com.routewise.comparison.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import com.routewise.comparison.domain.CostQuote;
import com.routewise.comparison.domain.CostSource;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.flightprice.domain.LiveFare;
import com.routewise.pricing.domain.Fare;
import com.routewise.pricing.domain.LegPricing;
import com.routewise.transportmode.domain.TransportModeCode;

import org.junit.jupiter.api.Test;

/**
 * Hand-computed costs; the modes are the seeded ones from {@link ComparisonEngineTest#SEEDED_MODES}.
 */
class CostModelTest {

    private static final ModeParameters TRAIN = mode(TransportModeCode.TRAIN);
    private static final ModeParameters BUS = mode(TransportModeCode.BUS);
    private static final ModeParameters CAR = mode(TransportModeCode.CAR);
    private static final ModeParameters BIKE = mode(TransportModeCode.BIKE);
    private static final ModeParameters PLANE = mode(TransportModeCode.PLANE);

    private static final Fare WEST_PLANE = new Fare(new BigDecimal("40.00"), new BigDecimal("0.070"));

    private static final Instant FETCHED = Instant.parse("2026-11-20T09:30:00Z");
    private static final LiveFare LIVE_89 = new LiveFare(new BigDecimal("89"), FETCHED);

    @Test
    void quote_planeWithLiveFare_isTheLiveFarePerTraveler() {
        // 89 EUR x 3 travelers = 267.00; the regional fare (40 + 0.07 x 1400 = 138 per traveler) is not used.
        LegPricing pricing = new LegPricing(null, null, Map.of(TransportModeCode.PLANE, WEST_PLANE))
                .withLivePlaneFare(Optional.of(LIVE_89));

        assertThat(CostModel.quote(PLANE, 1400, 3, pricing))
                .isEqualTo(new CostQuote(new BigDecimal("267.00"), CostSource.LIVE, FETCHED));
    }

    @Test
    void quote_planeWithoutLiveFare_isTheEstimate() {
        // 40 + 0.07 x 1000 = 110.00
        LegPricing pricing = new LegPricing(null, null, Map.of(TransportModeCode.PLANE, WEST_PLANE))
                .withLivePlaneFare(Optional.empty());

        assertThat(CostModel.quote(PLANE, 1000, 1, pricing))
                .isEqualTo(new CostQuote(new BigDecimal("110.00"), CostSource.ESTIMATE, null));
    }

    @Test
    void quote_otherModes_ignoreTheLiveFlightFare() {
        // Train without a regional fare: per-km 0.12 x 500 = 60.00, whatever the flight costs.
        LegPricing pricing = LegPricing.NONE.withLivePlaneFare(Optional.of(LIVE_89));

        assertThat(CostModel.quote(TRAIN, 500, 1, pricing))
                .isEqualTo(new CostQuote(new BigDecimal("60.00"), CostSource.ESTIMATE, null));
    }

    @Test
    void cost_carInGermany_usesFuelOnly() {
        // 0.065 l/km x 1.75 EUR/l = 0.11375 EUR/km; x 500 km = 56.875 -> 56.88
        LegPricing germany = new LegPricing(new BigDecimal("1.750"), new BigDecimal("0.000"), Map.of());

        assertThat(CostModel.cost(CAR, 500, 1, germany)).isEqualByComparingTo("56.88");
    }

    @Test
    void cost_carInTheUs_addsTolls() {
        // 0.065 x 0.80 + 0.01 = 0.062 EUR/km; x 500 km = 31.00
        LegPricing us = new LegPricing(new BigDecimal("0.800"), new BigDecimal("0.010"), Map.of());

        assertThat(CostModel.cost(CAR, 500, 1, us)).isEqualByComparingTo("31.00");
    }

    @Test
    void cost_twoCarsInFrance_paysPerCar() {
        // 0.065 x 1.80 + 0.06 = 0.177 EUR/km; x 400 km x 2 cars = 141.60
        LegPricing france = new LegPricing(new BigDecimal("1.800"), new BigDecimal("0.060"), Map.of());

        assertThat(CostModel.cost(CAR, 400, 2, france)).isEqualByComparingTo("141.60");
    }

    @Test
    void cost_planeWithRegionalFare_addsTheBaseFarePerTraveler() {
        // (40 + 0.07 x 1000) = 110 per traveler; x 2 travelers = 220.00
        LegPricing westernEurope = new LegPricing(null, null, Map.of(TransportModeCode.PLANE, WEST_PLANE));

        assertThat(CostModel.cost(PLANE, 1000, 2, westernEurope)).isEqualByComparingTo("220.00");
    }

    @Test
    void cost_busWithRegionalFare_scalesWithTravelers() {
        // (3 + 0.05 x 260) = 16 per traveler; x 3 travelers = 48.00
        LegPricing bus = new LegPricing(null, null,
                Map.of(TransportModeCode.BUS, new Fare(new BigDecimal("3.00"), new BigDecimal("0.050"))));

        assertThat(CostModel.cost(BUS, 260, 3, bus)).isEqualByComparingTo("48.00");
    }

    @Test
    void cost_withoutRegionalPrices_fallsBackToTheModesCostPerKm() {
        // 0.12 EUR/km x 100 km x 2 travelers = 24.00 (train); 0.20 x 100 x 1 car = 20.00
        assertThat(CostModel.cost(TRAIN, 100, 2, LegPricing.NONE)).isEqualByComparingTo("24.00");
        assertThat(CostModel.cost(CAR, 100, 1, LegPricing.NONE)).isEqualByComparingTo("20.00");
    }

    @Test
    void cost_modeWithoutAFare_fallsBackEvenWhenOtherModesHaveOne() {
        // Only PLANE has a fare: the bike stays free and the train pays 0.12 x 50 = 6.00.
        LegPricing planeOnly = new LegPricing(new BigDecimal("1.750"), new BigDecimal("0.000"),
                Map.of(TransportModeCode.PLANE, WEST_PLANE));

        assertThat(CostModel.cost(BIKE, 50, 1, planeOnly)).isEqualByComparingTo("0.00");
        assertThat(CostModel.cost(TRAIN, 50, 1, planeOnly)).isEqualByComparingTo("6.00");
    }

    private static ModeParameters mode(TransportModeCode code) {
        return ComparisonEngineTest.SEEDED_MODES.stream().filter(mode -> mode.code() == code).findFirst()
                .orElseThrow();
    }
}
