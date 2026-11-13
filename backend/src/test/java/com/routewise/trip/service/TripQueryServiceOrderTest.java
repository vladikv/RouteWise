package com.routewise.trip.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripFigures;
import com.routewise.trip.domain.TripSortKey;

import org.junit.jupiter.api.Test;

class TripQueryServiceOrderTest {

    private static final LocalDate DAY = LocalDate.of(2026, 12, 1);

    // cost: cheap < mid < dear; co2: cheap (5) < dear (20) < mid (50); date: dear < mid < cheap
    private final FiguredTrip cheap = item(1L, DAY.plusDays(3), "10.00", "5.0");
    private final FiguredTrip mid = item(2L, DAY.plusDays(2), "50.00", "50.0");
    private final FiguredTrip dear = item(3L, DAY.plusDays(1), "90.00", "20.0");
    private final FiguredTrip noFigures = new FiguredTrip(trip(4L, DAY), Optional.empty());

    @Test
    void order_dateAscending_sortsByDeparture() {
        assertThat(ids(TripSortKey.DATE, false, cheap, mid, dear)).containsExactly(3L, 2L, 1L);
    }

    @Test
    void order_dateDescending_reversesDeparture() {
        assertThat(ids(TripSortKey.DATE, true, dear, mid, cheap)).containsExactly(1L, 2L, 3L);
    }

    @Test
    void order_sameDate_isOrderedById() {
        FiguredTrip first = item(5L, DAY, "1.00", "1.0");
        FiguredTrip second = item(9L, DAY, "1.00", "1.0");

        assertThat(ids(TripSortKey.DATE, false, second, first)).containsExactly(5L, 9L);
        assertThat(ids(TripSortKey.DATE, true, first, second)).containsExactly(9L, 5L);
    }

    @Test
    void order_costAscending_putsCheapestFirstAndTripsWithoutFiguresLast() {
        assertThat(ids(TripSortKey.COST, false, noFigures, dear, cheap, mid)).containsExactly(1L, 2L, 3L, 4L);
    }

    @Test
    void order_costDescending_putsDearestFirstAndTripsWithoutFiguresStillLast() {
        assertThat(ids(TripSortKey.COST, true, noFigures, cheap, dear, mid)).containsExactly(3L, 2L, 1L, 4L);
    }

    @Test
    void order_co2Ascending_putsCleanestFirstAndTripsWithoutFiguresLast() {
        assertThat(ids(TripSortKey.CO2, false, noFigures, mid, dear, cheap)).containsExactly(1L, 3L, 2L, 4L);
    }

    @Test
    void order_co2Descending_putsDirtiestFirstAndTripsWithoutFiguresStillLast() {
        assertThat(ids(TripSortKey.CO2, true, noFigures, cheap, dear, mid)).containsExactly(2L, 3L, 1L, 4L);
    }

    @Test
    void order_equalCost_tiesAreOrderedByDateThenIdInBothDirections() {
        FiguredTrip lateDate = item(1L, DAY.plusDays(5), "20.00", "1.0");
        FiguredTrip earlyHighId = item(8L, DAY, "20.00", "1.0");
        FiguredTrip earlyLowId = item(7L, DAY, "20.00", "1.0");

        assertThat(ids(TripSortKey.COST, false, lateDate, earlyHighId, earlyLowId)).containsExactly(7L, 8L, 1L);
        assertThat(ids(TripSortKey.COST, true, lateDate, earlyHighId, earlyLowId)).containsExactly(7L, 8L, 1L);
    }

    @Test
    void order_severalTripsWithoutFigures_areOrderedAmongThemselvesByDateThenId() {
        FiguredTrip noFiguresLater = new FiguredTrip(trip(2L, DAY.plusDays(1)), Optional.empty());
        FiguredTrip noFiguresSameDayHigherId = new FiguredTrip(trip(6L, DAY), Optional.empty());

        assertThat(ids(TripSortKey.CO2, false, noFiguresLater, noFiguresSameDayHigherId, noFigures, cheap))
                .containsExactly(1L, 4L, 6L, 2L);
    }

    @Test
    void order_equalCo2_tiesAreOrderedByDateThenId() {
        FiguredTrip earlier = item(2L, DAY.plusDays(1), "5.00", "7.0");
        FiguredTrip later = item(1L, DAY.plusDays(2), "5.00", "7.0");

        assertThat(ids(TripSortKey.CO2, true, later, earlier)).containsExactly(2L, 1L);
    }

    private static List<Long> ids(TripSortKey key, boolean descending, FiguredTrip... items) {
        return List.of(items).stream()
                .sorted(TripQueryService.order(key, descending))
                .map(item -> item.trip().getId())
                .toList();
    }

    private static FiguredTrip item(Long id, LocalDate departure, String cost, String co2) {
        TripFigures figures = new TripFigures(new BigDecimal(cost), new BigDecimal(co2), null, null, null,
                List.of(TransportModeCode.TRAIN), List.of(TransportModeCode.TRAIN));
        return new FiguredTrip(trip(id, departure), Optional.of(figures));
    }

    private static Trip trip(Long id, LocalDate departure) {
        Trip trip = new Trip();
        trip.setId(id);
        trip.setTitle("Trip " + id);
        trip.setDepartureDate(departure);
        return trip;
    }
}
