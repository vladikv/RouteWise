package com.routewise.trip.dto;

import java.util.List;

import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;

/**
 * Chip counts. {@code priorities} count the trips matching every filter except the priority filter,
 * {@code modes} those matching every filter except the mode filter. Every priority and mode is listed.
 */
public record TripFacetsResponse(List<PriorityCount> priorities, List<ModeCount> modes) {

    public record PriorityCount(TripPriority priority, long count) {
    }

    /** Trips whose recommended plan uses the mode on at least one leg. */
    public record ModeCount(TransportModeCode mode, long count) {
    }
}
