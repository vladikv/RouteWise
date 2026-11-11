package com.routewise.trip.repository;

import java.util.List;
import java.util.Optional;

import com.routewise.trip.domain.Trip;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripRepository extends JpaRepository<Trip, Long> {

    @EntityGraph(attributePaths = {"origin", "destination"})
    List<Trip> findAllByOrderByDepartureDateAscIdAsc();

    @EntityGraph(attributePaths = {"origin", "destination"})
    Optional<Trip> findWithCitiesById(Long id);
}
