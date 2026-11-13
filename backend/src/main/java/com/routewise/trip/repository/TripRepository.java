package com.routewise.trip.repository;

import java.util.List;
import java.util.Optional;

import com.routewise.trip.domain.Trip;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripRepository extends JpaRepository<Trip, Long> {

    @EntityGraph(attributePaths = {"stops", "stops.city"})
    List<Trip> findAllByOwnerIdAndDeletedAtIsNullOrderByDepartureDateAscIdAsc(Long ownerId);

    /**
     * An active (not deleted) trip of the owner. Empty for someone else's or a deleted trip,
     * so callers answer 404 and reveal nothing.
     */
    @EntityGraph(attributePaths = {"stops", "stops.city"})
    Optional<Trip> findActiveWithStopsByIdAndOwnerIdAndDeletedAtIsNull(Long id, Long ownerId);

    /** The owner's trip, deleted or not; only restore needs to see deleted trips. */
    @EntityGraph(attributePaths = {"stops", "stops.city"})
    Optional<Trip> findWithStopsByIdAndOwnerId(Long id, Long ownerId);
}
