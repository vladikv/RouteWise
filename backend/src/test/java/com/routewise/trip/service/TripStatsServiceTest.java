package com.routewise.trip.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripFigures;
import com.routewise.trip.dto.TripStatsResponse;

import org.junit.jupiter.api.Test;

class TripStatsServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 13);

    @Test
    void stats_noTrips_returnsZerosNullAverageAndNoNextTrip() {
        TripStatsResponse stats = TripStatsService.stats(List.of(), TODAY);

        assertThat(stats.tripsPlanned()).isZero();
        assertThat(stats.co2SavedVsCarKg()).isEqualTo(new BigDecimal("0.0"));
        assertThat(stats.co2TripsCounted()).isZero();
        assertThat(stats.tripsLeftOut()).isZero();
        assertThat(stats.averageCost()).isNull();
        assertThat(stats.currency()).isEqualTo("EUR");
        assertThat(stats.nextTrip()).isNull();
    }

    @Test
    void stats_tripBelowCar_savesTheDifference() {
        // car 323.0 - plan 61.0 = 262.0 saved
        TripStatsResponse stats = TripStatsService.stats(
                List.of(trip(1L, "A", TODAY, figures("100.00", "61.0", "323.0"))), TODAY);

        assertThat(stats.co2SavedVsCarKg()).isEqualTo(new BigDecimal("262.0"));
        assertThat(stats.co2TripsCounted()).isEqualTo(1);
        assertThat(stats.tripsLeftOut()).isZero();
        assertThat(stats.tripsPlanned()).isEqualTo(1);
    }

    @Test
    void stats_planEmitsMoreThanCar_contributesZeroButIsCounted() {
        // plan 400.0 > car 323.0 -> max(0, -77) = 0; the other trip saves 262.0
        TripStatsResponse stats = TripStatsService.stats(List.of(
                trip(1L, "Above", TODAY, figures("300.00", "400.0", "323.0")),
                trip(2L, "Below", TODAY, figures("100.00", "61.0", "323.0"))), TODAY);

        assertThat(stats.co2SavedVsCarKg()).isEqualTo(new BigDecimal("262.0"));
        assertThat(stats.co2TripsCounted()).isEqualTo(2);
    }

    @Test
    void stats_tripWithoutCar_isLeftOutOfCo2ButCountedInAverage() {
        // costs 100.00 and 25.50 -> average 62.75; only the first has a car
        TripStatsResponse stats = TripStatsService.stats(List.of(
                trip(1L, "With car", TODAY, figures("100.00", "61.0", "323.0")),
                trip(2L, "No car", TODAY, figures("25.50", "900.0", null))), TODAY);

        assertThat(stats.tripsPlanned()).isEqualTo(2);
        assertThat(stats.co2TripsCounted()).isEqualTo(1);
        assertThat(stats.tripsLeftOut()).isEqualTo(1);
        assertThat(stats.co2SavedVsCarKg()).isEqualTo(new BigDecimal("262.0"));
        assertThat(stats.averageCost()).isEqualTo(new BigDecimal("62.75"));
    }

    @Test
    void stats_tripWithoutFigures_isLeftOutAndNotInAverage() {
        TripStatsResponse stats = TripStatsService.stats(List.of(
                trip(1L, "Planned", TODAY, figures("80.00", "10.0", "50.0")),
                new FiguredTrip(trip(2L, "Nothing", TODAY), Optional.empty())), TODAY);

        assertThat(stats.tripsPlanned()).isEqualTo(2);
        assertThat(stats.co2TripsCounted()).isEqualTo(1);
        assertThat(stats.tripsLeftOut()).isEqualTo(1);
        assertThat(stats.averageCost()).isEqualTo(new BigDecimal("80.00"));
    }

    @Test
    void stats_onlyTripsWithoutFigures_hasNullAverage() {
        TripStatsResponse stats = TripStatsService.stats(
                List.of(new FiguredTrip(trip(1L, "Nothing", TODAY), Optional.empty())), TODAY);

        assertThat(stats.averageCost()).isNull();
        assertThat(stats.tripsLeftOut()).isEqualTo(1);
        assertThat(stats.co2SavedVsCarKg()).isEqualTo(new BigDecimal("0.0"));
    }

    @Test
    void stats_savedCo2_isRoundedToOneDecimalHalfUp() {
        // 10.05 - 10.00 = 0.05 -> 0.1
        TripStatsResponse stats = TripStatsService.stats(
                List.of(trip(1L, "A", TODAY, figures("10.00", "10.00", "10.05"))), TODAY);

        assertThat(stats.co2SavedVsCarKg()).isEqualTo(new BigDecimal("0.1"));
    }

    @Test
    void stats_averageCost_isRoundedToTwoDecimalsHalfUp() {
        // (10.00 + 10.01) / 2 = 10.005 -> 10.01
        TripStatsResponse stats = TripStatsService.stats(List.of(
                trip(1L, "A", TODAY, figures("10.00", "1.0", null)),
                trip(2L, "B", TODAY, figures("10.01", "1.0", null))), TODAY);

        assertThat(stats.averageCost()).isEqualTo(new BigDecimal("10.01"));
    }

    @Test
    void stats_tripDepartingToday_isTheNextTrip() {
        TripStatsResponse stats = TripStatsService.stats(List.of(
                trip(1L, "Yesterday", TODAY.minusDays(1), figures("1.00", "1.0", null)),
                trip(2L, "Today", TODAY, figures("1.00", "1.0", null)),
                trip(3L, "Later", TODAY.plusDays(4), figures("1.00", "1.0", null))), TODAY);

        assertThat(stats.nextTrip()).isEqualTo(new TripStatsResponse.NextTrip(2L, "Today", TODAY));
    }

    @Test
    void stats_pastTripsSkipped_nextIsTheFirstUpcoming() {
        TripStatsResponse stats = TripStatsService.stats(List.of(
                trip(1L, "Long ago", TODAY.minusDays(30), figures("1.00", "1.0", null)),
                trip(2L, "Soon", TODAY.plusDays(2), figures("1.00", "1.0", null)),
                trip(3L, "Later", TODAY.plusDays(9), figures("1.00", "1.0", null))), TODAY);

        assertThat(stats.nextTrip()).isEqualTo(new TripStatsResponse.NextTrip(2L, "Soon", TODAY.plusDays(2)));
        assertThat(stats.tripsPlanned()).isEqualTo(3);
    }

    @Test
    void stats_onlyPastTrips_hasNoNextTrip() {
        TripStatsResponse stats = TripStatsService.stats(
                List.of(trip(1L, "Past", TODAY.minusDays(1), figures("1.00", "1.0", null))), TODAY);

        assertThat(stats.nextTrip()).isNull();
    }

    @Test
    void stats_nextTripWithoutFigures_isStillTheNextTrip() {
        TripStatsResponse stats = TripStatsService.stats(
                List.of(new FiguredTrip(trip(5L, "No plan", TODAY.plusDays(1)), Optional.empty())), TODAY);

        assertThat(stats.nextTrip().id()).isEqualTo(5L);
    }

    @Test
    void stats_forOwner_usesTheClockForToday() {
        TripQueryService queryService = mock(TripQueryService.class);
        when(queryService.activeTrips(7L)).thenReturn(List.of(
                trip(1L, "Yesterday", TODAY.minusDays(1), figures("1.00", "1.0", null)),
                trip(2L, "Tomorrow", TODAY.plusDays(1), figures("1.00", "1.0", null))));
        Clock clock = Clock.fixed(Instant.parse("2026-11-13T23:30:00Z"), ZoneOffset.UTC);

        TripStatsResponse stats = new TripStatsService(queryService, clock).stats(7L);

        assertThat(stats.tripsPlanned()).isEqualTo(2);
        assertThat(stats.nextTrip().title()).isEqualTo("Tomorrow");
    }

    private static FiguredTrip trip(Long id, String title, LocalDate departure, TripFigures figures) {
        return new FiguredTrip(trip(id, title, departure), Optional.of(figures));
    }

    private static Trip trip(Long id, String title, LocalDate departure) {
        Trip trip = new Trip();
        trip.setId(id);
        trip.setTitle(title);
        trip.setDepartureDate(departure);
        return trip;
    }

    private static TripFigures figures(String cost, String co2, String carCo2) {
        return new TripFigures(new BigDecimal(cost), new BigDecimal(co2),
                carCo2 == null ? null : new BigDecimal(carCo2), null, null,
                List.of(TransportModeCode.TRAIN), List.of(TransportModeCode.TRAIN));
    }
}
