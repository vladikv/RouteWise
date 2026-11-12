package com.routewise.trip.repository;

import java.util.List;
import java.util.Optional;

import com.routewise.trip.domain.Trip;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripRepository extends JpaRepository<Trip, Long> {

    @EntityGraph(attributePaths = {"stops", "stops.city"})
    List<Trip> findAllByOwnerIdOrderByDepartureDateAscIdAsc(Long ownerId);

    /** Empty for someone else's trip, so callers answer 404 and reveal nothing. */
    @EntityGraph(attributePaths = {"stops", "stops.city"})
    Optional<Trip> findWithStopsByIdAndOwnerId(Long id, Long ownerId);
}
