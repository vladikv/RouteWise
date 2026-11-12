package com.routewise.trip.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import com.routewise.city.domain.City;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ResourceNotFoundException;
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
    private final Clock clock;

    public TripService(TripRepository tripRepository, StopResolver stopResolver, TripMapper tripMapper,
                       Clock clock) {
        this.tripRepository = tripRepository;
        this.stopResolver = stopResolver;
        this.tripMapper = tripMapper;
        this.clock = clock;
    }

    /**
     * Returns the owner's trips, soonest departure first.
     */
    @Transactional(readOnly = true)
    public List<TripResponse> findAll(Long ownerId) {
        return tripRepository.findAllByOwnerIdOrderByDepartureDateAscIdAsc(ownerId).stream()
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
        // Flush so that @UpdateTimestamp is applied before the response is built.
        return tripMapper.toResponse(tripRepository.saveAndFlush(trip));
    }

    public void delete(Long id, Long ownerId) {
        tripRepository.delete(getTrip(id, ownerId));
    }

    /** Someone else's trip is "not found", like a missing one. */
    private Trip getTrip(Long id, Long ownerId) {
        return tripRepository.findWithStopsByIdAndOwnerId(id, ownerId)
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
