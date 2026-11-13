package com.routewise.trip.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.routewise.city.domain.City;
import com.routewise.common.exception.ConflictException;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.trip.config.TripProperties;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.dto.TripRequest;
import com.routewise.trip.dto.TripResponse;
import com.routewise.trip.mapper.TripMapper;
import com.routewise.trip.repository.TripRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TripService {

    private static final String RESOURCE = "Trip";

    private final TripRepository tripRepository;
    private final StopResolver stopResolver;
    private final TripMapper tripMapper;
    private final TripProperties properties;
    private final Clock clock;

    public TripService(TripRepository tripRepository, StopResolver stopResolver, TripMapper tripMapper,
                       TripProperties properties, Clock clock) {
        this.tripRepository = tripRepository;
        this.stopResolver = stopResolver;
        this.tripMapper = tripMapper;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Returns the owner's trips, soonest departure first.
     */
    @Transactional(readOnly = true)
    public List<TripResponse> findAll(Long ownerId) {
        return tripRepository.findAllByOwnerIdAndDeletedAtIsNullOrderByDepartureDateAscIdAsc(ownerId).stream()
                .map(tripMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TripResponse findById(Long id, Long ownerId) {
        return tripMapper.toResponse(getTrip(id, ownerId));
    }

    /**
     * Creates a trip; the departure date must be today or later.
     */
    public TripResponse create(TripRequest request, Long ownerId) {
        requireNotInPast(request.departureDate());
        Trip trip = new Trip();
        trip.setOwnerId(ownerId);
        apply(request, trip);
        return tripMapper.toResponse(tripRepository.saveAndFlush(trip));
    }

    /**
     * Replaces all editable fields of an existing trip. A past departure date may
     * be kept (so past trips stay editable), but a changed date must be today or later.
     */
    public TripResponse update(Long id, TripRequest request, Long ownerId) {
        Trip trip = getTrip(id, ownerId);
        if (!request.departureDate().equals(trip.getDepartureDate())) {
            requireNotInPast(request.departureDate());
        }
        apply(request, trip);
        // Flush so that @LastModifiedDate is applied before the response is built.
        return tripMapper.toResponse(tripRepository.saveAndFlush(trip));
    }

    /**
     * Soft delete: the trip disappears from every query but can be restored within the
     * restore window. Deleting it again answers 404.
     */
    public void delete(Long id, Long ownerId) {
        getTrip(id, ownerId).markDeleted(clock.instant());
    }

    /**
     * Undoes a delete while {@code now <= deletedAt + restoreWindow}. Restoring an active
     * trip changes nothing, so a repeated Undo is harmless.
     *
     * @throws ConflictException after the restore window
     */
    public TripResponse restore(Long id, Long ownerId) {
        Trip trip = tripRepository.findWithStopsByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));
        if (!trip.isDeleted()) {
            return tripMapper.toResponse(trip);
        }
        Instant deadline = trip.getDeletedAt().plus(properties.restoreWindow());
        if (clock.instant().isAfter(deadline)) {
            throw new ConflictException("Trip %d can no longer be restored: the restore window of %d s has passed"
                    .formatted(id, properties.restoreWindow().toSeconds()));
        }
        trip.restore();
        return tripMapper.toResponse(tripRepository.saveAndFlush(trip));
    }

    /** Someone else's or a deleted trip is "not found", like a missing one. */
    private Trip getTrip(Long id, Long ownerId) {
        return tripRepository.findActiveByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));
    }

    private void requireNotInPast(LocalDate departureDate) {
        if (departureDate.isBefore(LocalDate.now(clock))) {
            throw new FieldValidationException("departureDate", "must be today or later");
        }
    }

    private void apply(TripRequest request, Trip trip) {
        List<City> stopCities = stopResolver.resolve(request.stops());
        tripMapper.updateEntity(trip, request, stopCities);
    }
}
