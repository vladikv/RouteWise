package com.routewise.trip.repository;

import java.util.List;
import java.util.Optional;

import com.routewise.trip.domain.Trip;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface TripRepository extends JpaRepository<Trip, Long>, JpaSpecificationExecutor<Trip> {

    /** Trips matching {@code spec} (see {@link TripSpecifications}) with their stops and cities. */
    @Override
    @EntityGraph(attributePaths = {"stops", "stops.city"})
    List<Trip> findAll(Specification<Trip> spec, Sort sort);

    /**
     * An active (not deleted) trip of the owner. Empty for someone else's or a deleted trip,
     * so callers answer 404 and reveal nothing.
     */
    @EntityGraph(attributePaths = {"stops", "stops.city"})
    @Query("SELECT t FROM Trip t WHERE t.id = :id AND t.ownerId = :ownerId AND t.deletedAt IS NULL")
    Optional<Trip> findActiveByIdAndOwnerId(Long id, Long ownerId);

    /** The owner's trip, deleted or not; only restore needs to see deleted trips. */
    @EntityGraph(attributePaths = {"stops", "stops.city"})
    Optional<Trip> findWithStopsByIdAndOwnerId(Long id, Long ownerId);
}
