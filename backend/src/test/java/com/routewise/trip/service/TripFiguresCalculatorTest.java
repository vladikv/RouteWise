package com.routewise.trip.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.comparison.domain.ItineraryTotals;
import com.routewise.comparison.domain.ModeTotals;
import com.routewise.comparison.domain.RoutePlan;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripFigures;

import org.junit.jupiter.api.Test;

class TripFiguresCalculatorTest {

    private static final TransportModeCode TRAIN = TransportModeCode.TRAIN;
    private static final TransportModeCode BUS = TransportModeCode.BUS;
    private static final TransportModeCode CAR = TransportModeCode.CAR;
    private static final TransportModeCode PLANE = TransportModeCode.PLANE;

    @Test
    void figures_planFarBelowCar_reportsNegativePercentAndShare() {
        // plan 61.0 kg, car 323.0 kg: 61 / 323 = 0.18885 -> (0.18885 - 1) * 100 = -81.1 -> -81; share 0.19
        RoutePlan plan = plan(itinerary(List.of(TRAIN), "120.50", "61.0"), carTotals("323.0"));

        TripFigures figures = TripFiguresCalculator.figures(plan).orElseThrow();

        assertThat(figures.totalCost()).isEqualByComparingTo("120.50");
        assertThat(figures.co2Kg()).isEqualByComparingTo("61.0");
        assertThat(figures.carCo2Kg()).isEqualByComparingTo("323.0");
        assertThat(figures.co2VsCarPercent()).isEqualTo(-81);
        assertThat(figures.co2ShareOfCar()).isEqualTo(new BigDecimal("0.19"));
        assertThat(figures.hasCar()).isTrue();
    }

    @Test
    void figures_planAboveCar_reportsPositivePercentAndShareCappedAtOne() {
        // plan 400 kg, car 323 kg: 400 / 323 = 1.2384 -> +23.84 -> +24; share 1.24 capped to 1.00
        RoutePlan plan = plan(itinerary(List.of(PLANE), "300.00", "400.0"), carTotals("323.0"));

        TripFigures figures = TripFiguresCalculator.figures(plan).orElseThrow();

        assertThat(figures.co2VsCarPercent()).isEqualTo(24);
        assertThat(figures.co2ShareOfCar()).isEqualTo(new BigDecimal("1.00"));
    }

    @Test
    void figures_planEqualToCar_reportsZeroPercentAndFullShare() {
        // 170.0 / 170.0 = 1 -> 0 %, share 1.00
        RoutePlan plan = plan(itinerary(List.of(CAR), "80.00", "170.0"), carTotals("170.0"));

        TripFigures figures = TripFiguresCalculator.figures(plan).orElseThrow();

        assertThat(figures.co2VsCarPercent()).isZero();
        assertThat(figures.co2ShareOfCar()).isEqualTo(new BigDecimal("1.00"));
    }

    @Test
    void figures_percentOnRoundingBoundary_roundsHalfAwayFromZero() {
        // 50.5 / 100 = 0.505 -> -49.5 % -> rounded half up (away from zero) to -50; share 0.505 -> 0.51
        RoutePlan plan = plan(itinerary(List.of(BUS), "10.00", "50.5"), carTotals("100.0"));

        TripFigures figures = TripFiguresCalculator.figures(plan).orElseThrow();

        assertThat(figures.co2VsCarPercent()).isEqualTo(-50);
        assertThat(figures.co2ShareOfCar()).isEqualTo(new BigDecimal("0.51"));
    }

    @Test
    void figures_carNotAvailable_hasNullCarFields() {
        ModeTotals carUnavailable = new ModeTotals(CAR, null, UnavailableCode.TOO_FAR, "too far");
        RoutePlan plan = plan(itinerary(List.of(PLANE), "500.00", "900.0"), carUnavailable);

        TripFigures figures = TripFiguresCalculator.figures(plan).orElseThrow();

        assertThat(figures.carCo2Kg()).isNull();
        assertThat(figures.co2VsCarPercent()).isNull();
        assertThat(figures.co2ShareOfCar()).isNull();
        assertThat(figures.hasCar()).isFalse();
        assertThat(figures.totalCost()).isEqualByComparingTo("500.00");
    }

    @Test
    void figures_noCarEntryInSingleModeTotals_hasNullCarFields() {
        ItineraryTotals train = itinerary(List.of(TRAIN), "10.00", "5.0");
        RoutePlan plan = new RoutePlan(List.of(), train, List.of(new ModeTotals(TRAIN, train, null, null)),
                List.of(), List.of());

        TripFigures figures = TripFiguresCalculator.figures(plan).orElseThrow();

        assertThat(figures.carCo2Kg()).isNull();
        assertThat(figures.co2VsCarPercent()).isNull();
    }

    @Test
    void figures_carWithZeroCo2_hasNullPercentAndShare() {
        RoutePlan plan = plan(itinerary(List.of(TRAIN), "10.00", "5.0"), carTotals("0.0"));

        TripFigures figures = TripFiguresCalculator.figures(plan).orElseThrow();

        assertThat(figures.carCo2Kg()).isEqualByComparingTo("0.0");
        assertThat(figures.co2VsCarPercent()).isNull();
        assertThat(figures.co2ShareOfCar()).isNull();
    }

    @Test
    void figures_carFigureComesFromTheCarEntryNotFromAnotherMode() {
        ModeTotals train = new ModeTotals(TRAIN, itinerary(List.of(TRAIN), "10.00", "35.0"), null, null);
        RoutePlan plan = new RoutePlan(List.of(), itinerary(List.of(BUS), "6.00", "27.0"),
                List.of(train, carTotals("170.0")), List.of(), List.of());

        TripFigures figures = TripFiguresCalculator.figures(plan).orElseThrow();

        // 27 / 170 = 0.1588 -> -84.1 -> -84; share 0.16
        assertThat(figures.carCo2Kg()).isEqualByComparingTo("170.0");
        assertThat(figures.co2VsCarPercent()).isEqualTo(-84);
        assertThat(figures.co2ShareOfCar()).isEqualTo(new BigDecimal("0.16"));
    }

    @Test
    void figures_withoutRecommendedItinerary_isEmpty() {
        RoutePlan plan = new RoutePlan(List.of(), null, List.of(carTotals("323.0")), List.of(), List.of());

        assertThat(TripFiguresCalculator.figures(plan)).isEmpty();
    }

    @Test
    void figures_repeatedModes_areDistinctInLegOrderAndLegModesKeepEveryLeg() {
        RoutePlan plan = plan(itinerary(List.of(TRAIN, BUS, TRAIN, PLANE, BUS), "1.00", "1.0"), carTotals("10.0"));

        TripFigures figures = TripFiguresCalculator.figures(plan).orElseThrow();

        assertThat(figures.modes()).containsExactly(TRAIN, BUS, PLANE);
        assertThat(figures.legModes()).containsExactly(TRAIN, BUS, TRAIN, PLANE, BUS);
    }

    private static RoutePlan plan(ItineraryTotals recommended, ModeTotals... singleModeTotals) {
        return new RoutePlan(List.of(), recommended, List.of(singleModeTotals), List.of(), List.of());
    }

    private static ModeTotals carTotals(String co2Kg) {
        return new ModeTotals(CAR, itinerary(List.of(CAR), "999.00", co2Kg), null, null);
    }

    private static ItineraryTotals itinerary(List<TransportModeCode> modes, String cost, String co2Kg) {
        return new ItineraryTotals(modes, 100, new BigDecimal(cost), new BigDecimal(co2Kg));
    }
}
