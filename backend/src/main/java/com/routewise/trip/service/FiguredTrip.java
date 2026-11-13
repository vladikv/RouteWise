package com.routewise.trip.service;

import java.util.Optional;

import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripFigures;

/** A trip with its figures; empty figures when some leg has no available mode. */
public record FiguredTrip(Trip trip, Optional<TripFigures> figures) {
}
