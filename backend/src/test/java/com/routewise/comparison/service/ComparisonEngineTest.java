package com.routewise.comparison.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.routewise.comparison.domain.ComparisonInput;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.Location;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.domain.WeatherForecast;

import org.junit.jupiter.api.Test;

class ComparisonEngineTest {

    /** Same values as the seeded transport modes (V2, PLANE updated by V7). */
    static final List<ModeParameters> SEEDED_MODES = List.of(
            new ModeParameters(TransportModeCode.TRAIN, 110, new BigDecimal("0.120"), 35, 30, 2000, null),
            new ModeParameters(TransportModeCode.BUS, 75, new BigDecimal("0.060"), 27, 20, 2500, null),
            new ModeParameters(TransportModeCode.CAR, 90, new BigDecimal("0.200"), 170, 10, 3000, null),
            new ModeParameters(TransportModeCode.BIKE, 18, new BigDecimal("0.000"), 0, 10, 150, null),
            new ModeParameters(TransportModeCode.PLANE, 750, new BigDecimal("0.150"), 183, 150, 20100, 200));

    private static final LocalDate DATE = LocalDate.of(2026, 11, 20);

    private final ComparisonEngine engine = new ComparisonEngine();

    @Test
    void compare_computesRouteDurationCostAndCo2PerMode() {
        List<ModeOption> options = engine.compare(input(100, 2, TripPriority.BALANCED, List.of()));

        ModeOption train = option(options, TransportModeCode.TRAIN);
        assertThat(train.routeKm()).isEqualTo(120.0);
        assertThat(train.durationMinutes()).isEqualTo(95);
        assertThat(train.totalCost()).isEqualByComparingTo("28.80");
        assertThat(train.co2Kg()).isEqualByComparingTo("8.4");

        ModeOption plane = option(options, TransportModeCode.PLANE);
        assertThat(plane.routeKm()).isEqualTo(100.0);
        assertThat(plane.durationMinutes()).isEqualTo(158);
    }

    @Test
    void compare_carCostIsPerVehicle() {
        ModeOption twoTravelers = option(engine.compare(input(100, 2, TripPriority.BALANCED, List.of())),
                TransportModeCode.CAR);
        assertThat(twoTravelers.totalCost()).isEqualByComparingTo("26.00");
        assertThat(twoTravelers.co2Kg()).isEqualByComparingTo("22.1");
        assertThat(twoTravelers.notes()).isEmpty();

        ModeOption sevenTravelers = option(engine.compare(input(100, 7, TripPriority.BALANCED, List.of())),
                TransportModeCode.CAR);
        assertThat(sevenTravelers.totalCost()).isEqualByComparingTo("52.00");
        assertThat(sevenTravelers.notes()).containsExactly("2 cars needed for 7 travelers");
    }

    @Test
    void carsNeeded_usesFiveSeatsPerCar() {
        assertThat(ComparisonEngine.carsNeeded(1)).isEqualTo(1);
        assertThat(ComparisonEngine.carsNeeded(5)).isEqualTo(1);
        assertThat(ComparisonEngine.carsNeeded(6)).isEqualTo(2);
        assertThat(ComparisonEngine.carsNeeded(9)).isEqualTo(2);
    }

    @Test
    void compare_modeBeyondMaxDistance_isUnavailableAndListedLast() {
        List<ModeOption> options = engine.compare(input(500, 1, TripPriority.BALANCED, List.of()));

        ModeOption bike = options.getLast();
        assertThat(bike.mode()).isEqualTo(TransportModeCode.BIKE);
        assertThat(bike.available()).isFalse();
        assertThat(bike.unavailableReason()).isEqualTo("Route of 650 km exceeds the BIKE limit of 150 km");
        assertThat(bike.durationMinutes()).isNull();
        assertThat(bike.totalCost()).isNull();
        assertThat(bike.score()).isZero();
        assertThat(bike.recommended()).isFalse();
    }

    @Test
    void compare_availableOptionsAreSortedByScoreAndExactlyOneIsRecommended() {
        List<ModeOption> options = engine.compare(input(500, 2, TripPriority.BALANCED, List.of()));

        List<ModeOption> available = options.stream().filter(ModeOption::available).toList();
        assertThat(available).extracting(ModeOption::score).isSortedAccordingTo((a, b) -> b - a);
        assertThat(options).filteredOn(ModeOption::recommended).singleElement()
                .isEqualTo(available.getFirst());
    }

    @Test
    void compare_fastestOnLongTrip_recommendsPlane() {
        assertThat(recommended(input(1500, 1, TripPriority.FASTEST, List.of()))).isEqualTo(TransportModeCode.PLANE);
    }

    @Test
    void compare_greenestOnMediumTrip_recommendsTrainAndRanksHighEmittersLast() {
        List<ModeOption> options = engine.compare(input(500, 1, TripPriority.GREENEST, List.of()));

        assertThat(options.stream().filter(ModeOption::recommended).findFirst().orElseThrow().mode())
                .isEqualTo(TransportModeCode.TRAIN);
        List<TransportModeCode> ranking = options.stream().filter(ModeOption::available)
                .map(ModeOption::mode).toList();
        assertThat(ranking.subList(2, 4))
                .containsExactlyInAnyOrder(TransportModeCode.CAR, TransportModeCode.PLANE);
    }

    @Test
    void compare_cheapestOnShortTrip_recommendsBike() {
        assertThat(recommended(input(40, 1, TripPriority.CHEAPEST, List.of()))).isEqualTo(TransportModeCode.BIKE);
    }

    @Test
    void compare_rainOnShortCheapTrip_penalizesBikeAndAddsNote() {
        ComparisonInput dry = input(40, 1, TripPriority.CHEAPEST, List.of());
        ComparisonInput rainy = input(40, 1, TripPriority.CHEAPEST, List.of(
                forecast("Berlin", 0, 10.0), forecast("Potsdam", 63, 10.0)));

        ModeOption dryBike = option(engine.compare(dry), TransportModeCode.BIKE);
        ModeOption rainyBike = option(engine.compare(rainy), TransportModeCode.BIKE);

        // Bike: time 0, cost 1, CO2 1 -> CHEAPEST 0.2*0 + 0.6*1 + 0.2*1 = 80; rain x0.4 = 32
        assertThat(dryBike.score()).isEqualTo(80);
        assertThat(dryBike.recommended()).isTrue();
        assertThat(rainyBike.score()).isEqualTo(32);
        assertThat(rainyBike.recommended()).isFalse();
        assertThat(rainyBike.notes()).containsExactly("Rain expected in Potsdam, cycling score reduced");
    }

    /**
     * 100 km straight line, 2 travelers, seeded modes. Hand-computed:
     * <pre>
     * mode   min  cost   CO2   time   cost   CO2    BALANCED
     * TRAIN   95  28.80   8.4  1.000  0.040  0.771  60.4
     * BUS    124  15.60   7.0  0.917  0.480  0.809  73.5
     * CAR     97  26.00  22.1  0.994  0.133  0.396  50.8
     * BIKE   443   0.00   0.0  0.000  1.000  1.000  66.7
     * PLANE  158  30.00  36.6  0.819  0.000  0.000  27.3
     * </pre>
     * PLANE uses the short-haul factor 183 g/km (100 km is below 3700 km): 183 * 100 * 2 / 1000 = 36.6 kg,
     * the CO2 maximum, so the CO2 scores are (36.6 - kg) / 36.6, e.g. TRAIN 0.771, BUS 0.809, CAR 0.396.
     * BALANCED = 100/3 * (time + cost + CO2) -> BUS 73.5, BIKE 66.7, TRAIN 60.4, CAR 50.8, PLANE 27.3.
     */
    @Test
    void compare_balanced_matchesHandComputedScores() {
        List<ModeOption> options = engine.compare(input(100, 2, TripPriority.BALANCED, List.of()));

        assertThat(options).extracting(ModeOption::mode, ModeOption::score).containsExactly(
                tuple(TransportModeCode.BUS, 74),
                tuple(TransportModeCode.BIKE, 67),
                tuple(TransportModeCode.TRAIN, 60),
                tuple(TransportModeCode.CAR, 51),
                tuple(TransportModeCode.PLANE, 27));
    }

    @Test
    void compare_snowAndIce_appliesRoadAndBikeMultipliersButNotTrain() {
        ComparisonInput snowy = input(100, 2, TripPriority.BALANCED, List.of(forecast("Munich", 73, -3.0)));

        List<ModeOption> options = engine.compare(snowy);

        // Raw scores from compare_balanced_matchesHandComputedScores: road x0.9, bike x0.4
        // BUS 73.5 * 0.9 = 66.2, CAR 50.8 * 0.9 = 45.7, BIKE 66.7 * 0.4 = 26.7, TRAIN unchanged 60.4
        assertThat(option(options, TransportModeCode.BUS).score()).isEqualTo(66);
        assertThat(option(options, TransportModeCode.CAR).score()).isEqualTo(46);
        assertThat(option(options, TransportModeCode.BIKE).score()).isEqualTo(27);
        assertThat(option(options, TransportModeCode.TRAIN).score()).isEqualTo(60);
        assertThat(option(options, TransportModeCode.CAR).notes())
                .containsExactly("Snow, icy roads expected in Munich, road travel score reduced");
        assertThat(option(options, TransportModeCode.TRAIN).notes()).isEmpty();
    }

    @Test
    void compare_badWeatherAtBothLocations_appliesPenaltyOnceWithOneNotePerLocation() {
        ComparisonInput rainy = input(100, 2, TripPriority.BALANCED, List.of(
                forecast("Berlin", 63, 10.0), forecast("Potsdam", 95, 10.0)));

        ModeOption bike = option(engine.compare(rainy), TransportModeCode.BIKE);

        assertThat(bike.score()).isEqualTo(27);
        assertThat(bike.notes()).containsExactly(
                "Rain expected in Berlin, cycling score reduced",
                "Thunderstorms expected in Potsdam, cycling score reduced");
    }

    @Test
    void compare_exactTie_isResolvedByModeOrder() {
        // BUS and CAR share the road detour factor, so identical parameters give an exact tie.
        ModeParameters car = new ModeParameters(TransportModeCode.CAR, 75, new BigDecimal("0.060"), 27, 20, 2500, null);
        ModeParameters bus = new ModeParameters(TransportModeCode.BUS, 75, new BigDecimal("0.060"), 27, 20, 2500, null);

        List<ModeOption> options = engine.compare(
                new ComparisonInput(100, true, 1, TripPriority.BALANCED, List.of(car, bus), List.of()));

        assertThat(options).extracting(ModeOption::mode, ModeOption::score, ModeOption::recommended)
                .containsExactly(
                        tuple(TransportModeCode.BUS, 100, true),
                        tuple(TransportModeCode.CAR, 100, false));
    }

    @Test
    void compare_allModesUnavailable_recommendsNothing() {
        List<ModeParameters> bikeOnly = List.of(SEEDED_MODES.get(3));

        List<ModeOption> options = engine.compare(
                new ComparisonInput(500, true, 1, TripPriority.BALANCED, bikeOnly, List.of()));

        assertThat(options).singleElement().satisfies(option -> {
            assertThat(option.available()).isFalse();
            assertThat(option.recommended()).isFalse();
        });
    }

    @Test
    void compare_singleAvailableMode_scores100AndIsRecommended() {
        List<ModeParameters> trainOnly = List.of(SEEDED_MODES.getFirst());
        List<ModeOption> options = engine.compare(
                new ComparisonInput(100, true, 1, TripPriority.BALANCED, trainOnly, List.of()));

        assertThat(options).singleElement().satisfies(option -> {
            assertThat(option.score()).isEqualTo(100);
            assertThat(option.recommended()).isTrue();
        });
    }

    @Test
    void compare_crossLandmassLeg_groundModesUnavailableWithCodeAndPlaneRecommended() {
        // Paris-New York is about 5837 km great circle; use 6000 km, 1 traveler.
        ComparisonInput input = new ComparisonInput(6000, false, 1, TripPriority.BALANCED, SEEDED_MODES, List.of());

        List<ModeOption> options = engine.compare(input);

        assertThat(options).extracting(ModeOption::mode).containsExactly(TransportModeCode.PLANE,
                TransportModeCode.TRAIN, TransportModeCode.BUS, TransportModeCode.CAR, TransportModeCode.BIKE);
        assertThat(options.getFirst().recommended()).isTrue();
        assertThat(options.subList(1, 5)).allSatisfy(ground -> {
            assertThat(ground.available()).isFalse();
            assertThat(ground.unavailableCode()).isEqualTo(UnavailableCode.DIFFERENT_LANDMASS);
            assertThat(ground.unavailableReason())
                    .isEqualTo("No land route between the cities for " + ground.mode());
            assertThat(ground.recommended()).isFalse();
            assertThat(ground.score()).isZero();
        });
        assertThat(options.getFirst().unavailableCode()).isNull();
        assertThat(options.getFirst().unavailableReason()).isNull();
    }

    @Test
    void compare_shortCrossLandmassLeg_onlyPlaneIsAvailable() {
        // Dublin to London is about 460 km: within every ground limit, but no land route.
        ComparisonInput input = new ComparisonInput(460, false, 1, TripPriority.CHEAPEST, SEEDED_MODES, List.of());

        List<ModeOption> options = engine.compare(input);

        assertThat(options).filteredOn(ModeOption::available).extracting(ModeOption::mode)
                .containsExactly(TransportModeCode.PLANE);
        // Short-haul: 183 g/km * 460 km / 1000 = 84.18 -> 84.2 kg; cost 0.15 * 460 = 69.00
        ModeOption plane = options.getFirst();
        assertThat(plane.co2Kg()).isEqualByComparingTo("84.2");
        assertThat(plane.totalCost()).isEqualByComparingTo("69.00");
    }

    @Test
    void compare_longHaulFlight_usesTheLongHaulFactor() {
        ComparisonInput input = new ComparisonInput(6000, false, 2, TripPriority.BALANCED, SEEDED_MODES, List.of());

        ModeOption plane = option(engine.compare(input), TransportModeCode.PLANE);

        // Long-haul 200 g/km * 6000 km * 2 travelers / 1000 = 2400.0 kg; cost 0.15 * 6000 * 2 = 1800.00
        // duration 150 + 6000 / 750 * 60 = 630 min
        assertThat(plane.co2Kg()).isEqualByComparingTo("2400.0");
        assertThat(plane.totalCost()).isEqualByComparingTo("1800.00");
        assertThat(plane.durationMinutes()).isEqualTo(630);
    }

    @Test
    void compare_flightAtExactlyTheThreshold_usesTheShortHaulFactor() {
        ComparisonInput atThreshold = new ComparisonInput(3700, false, 1, TripPriority.BALANCED, SEEDED_MODES,
                List.of());
        ComparisonInput above = new ComparisonInput(3701, false, 1, TripPriority.BALANCED, SEEDED_MODES, List.of());

        // 183 * 3700 / 1000 = 677.1 kg short-haul; 200 * 3701 / 1000 = 740.2 kg long-haul
        assertThat(option(engine.compare(atThreshold), TransportModeCode.PLANE).co2Kg())
                .isEqualByComparingTo("677.1");
        assertThat(option(engine.compare(above), TransportModeCode.PLANE).co2Kg()).isEqualByComparingTo("740.2");
    }

    @Test
    void compare_sameLandmassLongLeg_groundModeBeyondLimitIsTooFar() {
        ComparisonInput input = new ComparisonInput(500, true, 1, TripPriority.BALANCED, SEEDED_MODES, List.of());

        ModeOption bike = option(engine.compare(input), TransportModeCode.BIKE);

        assertThat(bike.unavailableCode()).isEqualTo(UnavailableCode.TOO_FAR);
    }

    private static ComparisonInput input(double km, int travelers, TripPriority priority,
                                         List<LocationForecast> forecasts) {
        return new ComparisonInput(km, true, travelers, priority, SEEDED_MODES, forecasts);
    }

    private static LocationForecast forecast(String city, int weatherCode, double minTemperature) {
        return new LocationForecast(new Location(city, 0, 0),
                new WeatherForecast(DATE, weatherCode, minTemperature, minTemperature + 6, 20, 10.0));
    }

    private TransportModeCode recommended(ComparisonInput input) {
        return engine.compare(input).stream().filter(ModeOption::recommended).findFirst().orElseThrow().mode();
    }

    private static ModeOption option(List<ModeOption> options, TransportModeCode mode) {
        return options.stream().filter(option -> option.mode() == mode).findFirst().orElseThrow();
    }
}
