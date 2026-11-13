package com.routewise.comparison.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.city.dto.CitySummary;
import com.routewise.comparison.domain.ItineraryTotals;
import com.routewise.comparison.domain.Leg;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeTotals;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.transportmode.domain.TransportModeCode;

import org.junit.jupiter.api.Test;

/** Hand-built legs, so every expected total below is plain addition. */
class ItineraryCalculatorTest {

    private static final CitySummary BERLIN = new CitySummary(1L, "Berlin", "DE");
    private static final CitySummary PRAGUE = new CitySummary(3L, "Prague", "CZ");
    private static final CitySummary VIENNA = new CitySummary(2L, "Vienna", "AT");

    private final ItineraryCalculator calculator = new ItineraryCalculator();

    /** Leg 1: train recommended (60 min, 20.00, 5.0 kg); bus available; bike too far. */
    private static final Leg BERLIN_PRAGUE = new Leg(BERLIN, PRAGUE, 280, List.of(
            option(TransportModeCode.TRAIN, 60, "20.00", "5.0", true),
            option(TransportModeCode.BUS, 90, "10.00", "3.0", false),
            unavailable(TransportModeCode.BIKE, "Route of 364 km exceeds the BIKE limit of 150 km")));

    /** Leg 2: bus recommended (45 min, 8.00, 2.0 kg); train and bike available. */
    private static final Leg PRAGUE_VIENNA = new Leg(PRAGUE, VIENNA, 120, List.of(
            option(TransportModeCode.BUS, 45, "8.00", "2.0", true),
            option(TransportModeCode.TRAIN, 30, "15.00", "4.0", false),
            option(TransportModeCode.BIKE, 200, "0.00", "0.0", false)));

    @Test
    void recommendedItinerary_sumsEachLegsRecommendedOption() {
        ItineraryTotals plan = calculator.recommendedItinerary(List.of(BERLIN_PRAGUE, PRAGUE_VIENNA)).orElseThrow();

        // 60 + 45 min, 20.00 + 8.00, 5.0 + 2.0 kg
        assertThat(plan.modes()).containsExactly(TransportModeCode.TRAIN, TransportModeCode.BUS);
        assertThat(plan.durationMinutes()).isEqualTo(105);
        assertThat(plan.totalCost()).isEqualByComparingTo("28.00");
        assertThat(plan.co2Kg()).isEqualByComparingTo("7.0");
    }

    @Test
    void recommendedItinerary_isEmptyWhenALegHasNoAvailableMode() {
        Leg blocked = new Leg(VIENNA, BERLIN, 520, List.of(unavailable(TransportModeCode.BIKE, "too far")));

        assertThat(calculator.recommendedItinerary(List.of(BERLIN_PRAGUE, blocked))).isEmpty();
    }

    @Test
    void singleModeTotals_sumAModeOverEveryLeg_inModeOrder() {
        List<ModeTotals> totals = calculator.singleModeTotals(List.of(BERLIN_PRAGUE, PRAGUE_VIENNA));

        assertThat(totals).extracting(ModeTotals::mode).containsExactly(TransportModeCode.values());
        // Train: 60 + 30 min, 20.00 + 15.00, 5.0 + 4.0 kg
        assertThat(totalsFor(totals, TransportModeCode.TRAIN).totals()).isEqualTo(new ItineraryTotals(
                List.of(TransportModeCode.TRAIN, TransportModeCode.TRAIN), 90, new BigDecimal("35.00"),
                new BigDecimal("9.0")));
        // Bus: 90 + 45 min, 10.00 + 8.00, 3.0 + 2.0 kg
        assertThat(totalsFor(totals, TransportModeCode.BUS).totals().durationMinutes()).isEqualTo(135);
        assertThat(totalsFor(totals, TransportModeCode.BUS).totals().totalCost()).isEqualByComparingTo("18.00");
    }

    @Test
    void singleModeTotals_aModeUnavailableOnOneLeg_namesThatLeg() {
        List<ModeTotals> totals = calculator.singleModeTotals(List.of(BERLIN_PRAGUE, PRAGUE_VIENNA));

        ModeTotals bike = totalsFor(totals, TransportModeCode.BIKE);
        assertThat(bike.available()).isFalse();
        assertThat(bike.totals()).isNull();
        assertThat(bike.unavailableReason())
                .isEqualTo("Leg 1 (Berlin to Prague): Route of 364 km exceeds the BIKE limit of 150 km");
        assertThat(totalsFor(totals, TransportModeCode.PLANE).unavailableReason())
                .isEqualTo("Leg 1 (Berlin to Prague): mode not offered");
    }

    @Test
    void recommendedItinerary_legWithOnlyPlane_usesPlaneThereAndGroundElsewhere() {
        Leg transatlantic = new Leg(PRAGUE, VIENNA, 5500, List.of(
                option(TransportModeCode.PLANE, 600, "500.00", "250.0", true),
                unavailable(TransportModeCode.TRAIN, UnavailableCode.DIFFERENT_LANDMASS,
                        "No land route between the cities for TRAIN")));

        ItineraryTotals plan = calculator.recommendedItinerary(List.of(BERLIN_PRAGUE, transatlantic)).orElseThrow();

        // 60 + 600 min, 20.00 + 500.00, 5.0 + 250.0 kg
        assertThat(plan.modes()).containsExactly(TransportModeCode.TRAIN, TransportModeCode.PLANE);
        assertThat(plan.durationMinutes()).isEqualTo(660);
        assertThat(plan.totalCost()).isEqualByComparingTo("520.00");
        assertThat(plan.co2Kg()).isEqualByComparingTo("255.0");
    }

    @Test
    void singleModeTotals_modeUnavailableOnSecondLeg_carriesCodeAndNamesLeg() {
        Leg transatlantic = new Leg(PRAGUE, VIENNA, 5500, List.of(
                option(TransportModeCode.PLANE, 600, "500.00", "250.0", true),
                unavailable(TransportModeCode.TRAIN, UnavailableCode.DIFFERENT_LANDMASS,
                        "No land route between the cities for TRAIN")));

        List<ModeTotals> totals = calculator.singleModeTotals(List.of(BERLIN_PRAGUE, transatlantic));

        ModeTotals train = totalsFor(totals, TransportModeCode.TRAIN);
        assertThat(train.available()).isFalse();
        assertThat(train.unavailableCode()).isEqualTo(UnavailableCode.DIFFERENT_LANDMASS);
        assertThat(train.unavailableReason())
                .isEqualTo("Leg 2 (Prague to Vienna): No land route between the cities for TRAIN");
    }

    @Test
    void singleModeTotals_modeNotOfferedOnALeg_hasNoCode() {
        List<ModeTotals> totals = calculator.singleModeTotals(List.of(BERLIN_PRAGUE));

        assertThat(totalsFor(totals, TransportModeCode.PLANE).unavailableCode()).isNull();
        assertThat(totalsFor(totals, TransportModeCode.TRAIN).unavailableCode()).isNull();
        assertThat(totalsFor(totals, TransportModeCode.BIKE).unavailableCode()).isEqualTo(UnavailableCode.TOO_FAR);
    }

    private static ModeTotals totalsFor(List<ModeTotals> totals, TransportModeCode mode) {
        return totals.stream().filter(t -> t.mode() == mode).findFirst().orElseThrow();
    }

    private static ModeOption option(TransportModeCode mode, int minutes, String cost, String co2,
                                     boolean recommended) {
        return new ModeOption(mode, true, null, null, 100, minutes, new BigDecimal(cost), new BigDecimal(co2), 50,
                recommended, List.of());
    }

    private static ModeOption unavailable(TransportModeCode mode, String reason) {
        return unavailable(mode, UnavailableCode.TOO_FAR, reason);
    }

    private static ModeOption unavailable(TransportModeCode mode, UnavailableCode code, String reason) {
        return new ModeOption(mode, false, code, reason, 400, null, null, null, 0, false, List.of());
    }
}
