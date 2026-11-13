package com.routewise.trip.domain;

import java.time.LocalDate;
import java.util.List;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * A validated trip search. Empty filter lists and {@code null} values mean "any".
 *
 * @param page 0-based
 */
public record TripSearchCriteria(
        String query,
        List<TripPriority> priorities,
        List<TransportModeCode> modes,
        LocalDate from,
        LocalDate to,
        TripSortKey sort,
        boolean descending,
        int page,
        int size) {

    public TripSearchCriteria {
        priorities = priorities == null ? List.of() : List.copyOf(priorities);
        modes = modes == null ? List.of() : List.copyOf(modes);
    }
}
