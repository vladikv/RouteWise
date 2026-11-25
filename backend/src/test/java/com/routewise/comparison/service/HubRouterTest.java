package com.routewise.comparison.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import com.routewise.city.dto.CitySummary;
import com.routewise.comparison.domain.FlightConnection;
import com.routewise.comparison.domain.RouteStop;

import org.assertj.core.data.Offset;
import org.junit.jupiter.api.Test;

/**
 * Points on the equator keep the distances easy to check: one degree of longitude is
 * 2π × 6371 km / 360 ≈ 111.19 km.
 */
class HubRouterTest {

    private static final Offset<Double> ONE_KM = Offset.offset(1.0);

    // 0° to 120° E: 120 × 111.19 ≈ 13,343 km, beyond the 12,000 km non-stop limit.
    private static final RouteStop FROM = stop(1L, "From", "AAA", 0);
    private static final RouteStop TO = stop(2L, "To", "BBB", 120);

    @Test
    void connect_legWithinNonStopLimit_isEmpty() {
        // 0° to 100° E ≈ 11,119 km.
        RouteStop near = stop(2L, "Near", "BBB", 100);

        assertThat(HubRouter.connect(FROM, near, List.of(stop(10L, "Mid", "MID", 50)))).isEmpty();
    }

    @Test
    void connect_longLeg_picksTheHubWithTheSmallestTotalDistance() {
        // Mid (60° E): 6,672 + 6,672 = 13,343 km; Off (60° E, 20° N) is longer on both flights.
        RouteStop mid = stop(10L, "Mid", "MID", 60);
        RouteStop off = new RouteStop(new CitySummary(11L, "Off", "XX"), 20, 60, "L", "OFF");

        FlightConnection connection = HubRouter.connect(FROM, TO, List.of(off, mid)).orElseThrow();

        assertThat(connection.hub().name()).isEqualTo("Mid");
        assertThat(connection.airportCode()).isEqualTo("MID");
        assertThat(connection.firstKm()).isCloseTo(6671.7, ONE_KM);
        assertThat(connection.secondKm()).isCloseTo(6671.7, ONE_KM);
        assertThat(connection.totalKm()).isCloseTo(13343.4, ONE_KM);
    }

    @Test
    void connect_hubWithAFlightBeyondTheLimit_isSkipped() {
        // Edge (10° E): 1,112 km, then 110 × 111.19 ≈ 12,231 km, beyond the limit.
        RouteStop edge = stop(10L, "Edge", "EDG", 10);

        assertThat(HubRouter.connect(FROM, TO, List.of(edge))).isEmpty();
    }

    @Test
    void connect_hubInALegCityOrAtALegAirport_isSkipped() {
        RouteStop sameCity = stop(1L, "From", "AAA", 0);
        RouteStop sameAirport = stop(12L, "Suburb", "BBB", 60);

        assertThat(HubRouter.connect(FROM, TO, List.of(sameCity, sameAirport))).isEmpty();
    }

    @Test
    void connect_cityWithoutAirport_isEmpty() {
        RouteStop noAirportTo = stop(2L, "To", null, 120);
        RouteStop noAirportFrom = stop(1L, "From", null, 0);
        List<RouteStop> hubs = List.of(stop(10L, "Mid", "MID", 60));

        assertThat(HubRouter.connect(FROM, noAirportTo, hubs)).isEmpty();
        assertThat(HubRouter.connect(noAirportFrom, TO, hubs)).isEmpty();
    }

    @Test
    void connect_legOfExactlyTheLimit_isFlownNonStop() {
        // 12,000 km along the equator: 12,000 / (2π × 6371 / 360) degrees of longitude.
        double degrees = 12_000 / (2 * Math.PI * 6371.0 / 360);
        RouteStop atLimit = stop(2L, "AtLimit", "BBB", degrees);

        assertThat(HubRouter.connect(FROM, atLimit, List.of(stop(10L, "Mid", "MID", degrees / 2)))).isEmpty();
    }

    @Test
    void connect_equalTotals_goToTheHubWhoseNameComesFirst() {
        RouteStop north = new RouteStop(new CitySummary(10L, "North", "XX"), 1, 60, "L", "NOR");
        RouteStop south = new RouteStop(new CitySummary(11L, "Aust", "XX"), -1, 60, "L", "AUS");

        assertThat(HubRouter.connect(FROM, TO, List.of(north, south)).orElseThrow().hub().name())
                .isEqualTo("Aust");
    }

    private static RouteStop stop(Long id, String name, String airportCode, double longitude) {
        return new RouteStop(new CitySummary(id, name, "XX"), 0, longitude, "L", airportCode);
    }
}
