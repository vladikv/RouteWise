package com.routewise.trip.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.city.TestCities;
import com.routewise.city.domain.City;
import com.routewise.comparison.domain.ItineraryTotals;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.domain.ModeTotals;
import com.routewise.comparison.domain.RoutePlan;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.comparison.service.ComparisonEngine;
import com.routewise.comparison.service.ItineraryCalculator;
import com.routewise.comparison.service.RoutePlanner;
import com.routewise.comparison.service.UnavailableGrouper;
import com.routewise.pricing.domain.PriceBook;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripFigures;
import com.routewise.trip.domain.TripPriority;

import org.junit.jupiter.api.Test;

class TripFiguresCalculatorTest {

    private static final TransportModeCode TRAIN = TransportModeCode.TRAIN;
    private static final TransportModeCode BUS = TransportModeCode.BUS;
    private static final TransportModeCode CAR = TransportModeCode.CAR;
    private static final TransportModeCode PLANE = TransportModeCode.PLANE;

    /** The seeded train and plane (speed, cost, CO2, overhead, range, long-haul CO2). */
    private static final List<ModeParameters> TRAIN_AND_PLANE = List.of(
            new ModeParameters(TRAIN, 110, new BigDecimal("0.120"), 35, 30, 2000, null),
            new ModeParameters(PLANE, 750, new BigDecimal("0.150"), 183, 150, 20100, 200));

    private final TripFiguresCalculator calculator = new TripFiguresCalculator(
            new RoutePlanner(new ComparisonEngine(), new ItineraryCalculator(), new UnavailableGrouper()));

    @Test
    void figures_tripBetweenCitiesWithAirports_canFly() {
        // Krakow-London is about 1410 km: plane 150 + 1410 / 750 * 60 = 263 min, train 30 + 1692 / 110 * 60 = 953 min.
        Trip trip = trip(TestCities.krakow(), TestCities.london());

        TripFigures figures = calculator.figures(trip, TRAIN_AND_PLANE, PriceBook.EMPTY, List.of()).orElseThrow();

        assertThat(figures.legModes()).containsExactly(PLANE);
    }

    @Test
    void figures_tripToACityWithoutAirport_takesTheTrainInstead() {
        // Krakow-Kharkiv is about 920 km; the plane would be far faster, but Kharkiv has no working airport.
        Trip trip = trip(TestCities.krakow(), TestCities.kharkiv());

        TripFigures figures = calculator.figures(trip, TRAIN_AND_PLANE, PriceBook.EMPTY, List.of()).orElseThrow();

        assertThat(figures.legModes()).containsExactly(TRAIN);
    }

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

    private static Trip trip(City... stops) {
        Trip trip = new Trip();
        trip.setTravelers(1);
        trip.setPriority(TripPriority.FASTEST);
        trip.replaceStops(List.of(stops));
        return trip;
    }
}
