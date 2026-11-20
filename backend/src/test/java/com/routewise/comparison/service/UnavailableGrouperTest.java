package com.routewise.comparison.service;

import static com.routewise.comparison.domain.UnavailableCode.DIFFERENT_LANDMASS;
import static com.routewise.comparison.domain.UnavailableCode.NO_AIRPORT;
import static com.routewise.comparison.domain.UnavailableCode.TOO_FAR;
import static com.routewise.transportmode.domain.TransportModeCode.BIKE;
import static com.routewise.transportmode.domain.TransportModeCode.BUS;
import static com.routewise.transportmode.domain.TransportModeCode.CAR;
import static com.routewise.transportmode.domain.TransportModeCode.PLANE;
import static com.routewise.transportmode.domain.TransportModeCode.TRAIN;
import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.city.dto.CitySummary;
import com.routewise.comparison.domain.CostSource;
import com.routewise.comparison.domain.ItineraryTotals;
import com.routewise.comparison.domain.Leg;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeTotals;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.comparison.domain.UnavailableGroup;
import com.routewise.transportmode.domain.TransportModeCode;

import org.junit.jupiter.api.Test;

class UnavailableGrouperTest {

    private static final CitySummary DUBLIN = new CitySummary(30L, "Dublin", "IE");
    private static final CitySummary MADRID = new CitySummary(15L, "Madrid", "ES");
    private static final CitySummary LISBON = new CitySummary(11L, "Lisbon", "PT");
    private static final CitySummary LONDON = new CitySummary(13L, "London", "GB");
    private static final CitySummary KRAKOW = new CitySummary(10L, "Krakow", "PL");
    private static final CitySummary KYIV = new CitySummary(327L, "Kyiv", "UA");
    private static final CitySummary KHARKIV = new CitySummary(326L, "Kharkiv", "UA");

    private final UnavailableGrouper grouper = new UnavailableGrouper();

    @Test
    void forLeg_allAvailable_isEmpty() {
        Leg leg = new Leg(LISBON, MADRID, 500, List.of(), List.of(available(TRAIN), available(PLANE)));

        assertThat(grouper.forLeg(leg)).isEmpty();
    }

    @Test
    void forLeg_groundModesAcrossTheSea_isOneSentenceWithModesInFixedOrder() {
        // Options arrive best first (plane available), the unavailable ground modes in any order.
        Leg leg = new Leg(DUBLIN, MADRID, 1450, List.of(), List.of(available(PLANE),
                unavailable(BIKE, DIFFERENT_LANDMASS), unavailable(TRAIN, DIFFERENT_LANDMASS),
                unavailable(CAR, DIFFERENT_LANDMASS), unavailable(BUS, DIFFERENT_LANDMASS)));

        assertThat(grouper.forLeg(leg)).containsExactly(new UnavailableGroup(DIFFERENT_LANDMASS,
                List.of(TRAIN, BUS, CAR, BIKE), "Not reachable by land between Dublin and Madrid: train, bus, car, bike"));
    }

    @Test
    void forLeg_twoReasons_giveOneSentenceEach_landmassFirst() {
        Leg leg = new Leg(DUBLIN, MADRID, 1450, List.of(), List.of(available(TRAIN),
                unavailable(BIKE, TOO_FAR), unavailable(PLANE, DIFFERENT_LANDMASS)));

        assertThat(grouper.forLeg(leg)).extracting(UnavailableGroup::message).containsExactly(
                "Not reachable by land between Dublin and Madrid: plane",
                "Too far between Dublin and Madrid for: bike");
    }

    @Test
    void forTotals_namesTheFirstBlockingLegPerReason() {
        Leg first = new Leg(LISBON, MADRID, 500, List.of(), List.of(available(TRAIN), available(BUS), available(CAR),
                unavailable(BIKE, TOO_FAR), available(PLANE)));
        Leg second = new Leg(MADRID, DUBLIN, 1450, List.of(), List.of(available(PLANE),
                unavailable(TRAIN, DIFFERENT_LANDMASS), unavailable(BUS, DIFFERENT_LANDMASS),
                unavailable(CAR, DIFFERENT_LANDMASS), unavailable(BIKE, DIFFERENT_LANDMASS)));
        List<ModeTotals> totals = List.of(blocked(TRAIN), blocked(BUS), blocked(CAR), blocked(BIKE),
                new ModeTotals(PLANE, new ItineraryTotals(List.of(PLANE, PLANE), 300, BigDecimal.TEN, BigDecimal.ONE),
                        null, null));

        // Bike is ruled out on leg 1 already (too far), the others only on leg 2 (sea).
        assertThat(grouper.forTotals(totals, List.of(first, second))).containsExactly(
                new UnavailableGroup(TOO_FAR, List.of(BIKE),
                        "Not possible for the whole trip: bike (too far between Lisbon and Madrid)"),
                new UnavailableGroup(DIFFERENT_LANDMASS, List.of(TRAIN, BUS, CAR),
                        "Not possible for the whole trip: train, bus, car (no land route between Madrid and Dublin)"));
    }

    @Test
    void forLeg_planeWithoutAirport_namesTheCity() {
        Leg leg = new Leg(LONDON, KHARKIV, 2537, List.of("Kharkiv"), List.of(unavailable(PLANE, NO_AIRPORT),
                unavailable(TRAIN, TOO_FAR), unavailable(BUS, TOO_FAR), unavailable(CAR, TOO_FAR),
                unavailable(BIKE, TOO_FAR)));

        assertThat(grouper.forLeg(leg)).containsExactly(
                new UnavailableGroup(TOO_FAR, List.of(TRAIN, BUS, CAR, BIKE),
                        "Too far between London and Kharkiv for: train, bus, car, bike"),
                new UnavailableGroup(NO_AIRPORT, List.of(PLANE), "No working airport in Kharkiv: plane"));
    }

    @Test
    void forLeg_neitherCityHasAnAirport_namesBoth() {
        Leg leg = new Leg(KYIV, KHARKIV, 410, List.of("Kyiv", "Kharkiv"), List.of(available(TRAIN),
                unavailable(PLANE, NO_AIRPORT)));

        assertThat(grouper.forLeg(leg)).extracting(UnavailableGroup::message)
                .containsExactly("No working airport in Kyiv and Kharkiv: plane");
    }

    @Test
    void forTotals_planeBlockedOnALaterLeg_namesItsCity() {
        Leg first = new Leg(LONDON, KRAKOW, 1410, List.of(), List.of(available(PLANE),
                unavailable(BIKE, TOO_FAR)));
        Leg second = new Leg(KRAKOW, KHARKIV, 920, List.of("Kharkiv"), List.of(available(TRAIN),
                unavailable(PLANE, NO_AIRPORT), unavailable(BIKE, TOO_FAR)));
        ModeTotals plane = new ModeTotals(PLANE, null, NO_AIRPORT, "Leg 2 (...): reason");

        assertThat(grouper.forTotals(List.of(plane), List.of(first, second))).containsExactly(
                new UnavailableGroup(NO_AIRPORT, List.of(PLANE),
                        "Not possible for the whole trip: plane (no working airport in Kharkiv)"));
    }

    @Test
    void forTotals_everyModeAvailable_isEmpty() {
        Leg leg = new Leg(LISBON, MADRID, 500, List.of(), List.of(available(TRAIN)));
        ModeTotals train = new ModeTotals(TRAIN, new ItineraryTotals(List.of(TRAIN), 300, BigDecimal.TEN,
                BigDecimal.ONE), null, null);

        assertThat(grouper.forTotals(List.of(train), List.of(leg))).isEmpty();
    }

    private static ModeOption available(TransportModeCode mode) {
        return new ModeOption(mode, true, null, null, 500, 300, BigDecimal.TEN, BigDecimal.ONE, 50, false, List.of(),
                CostSource.ESTIMATE, null);
    }

    private static ModeOption unavailable(TransportModeCode mode, UnavailableCode code) {
        return new ModeOption(mode, false, code, "reason", 500, null, null, null, 0, false, List.of(), null, null);
    }

    private static ModeTotals blocked(TransportModeCode mode) {
        return new ModeTotals(mode, null, TOO_FAR, "Leg 1 (...): reason");
    }
}
