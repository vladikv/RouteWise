package com.routewise.trip.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import com.routewise.city.domain.City;
import com.routewise.city.repository.CityRepository;
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
    private final CityRepository cityRepository;
    private final TripMapper tripMapper;
    private final Clock clock;

    public TripService(TripRepository tripRepository, CityRepository cityRepository, TripMapper tripMapper,
                       Clock clock) {
        this.tripRepository = tripRepository;
        this.cityRepository = cityRepository;
        this.tripMapper = tripMapper;
        this.clock = clock;
    }

    /**
     * Returns all trips, soonest departure first.
     */
    @Transactional(readOnly = true)
    public List<TripResponse> findAll() {
        return tripRepository.findAllByOrderByDepartureDateAscIdAsc().stream()
                .map(tripMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TripResponse findById(Long id) {
        return tripMapper.toResponse(getTrip(id));
    }

    /**
     * Creates a trip; the departure date must be today or later.
     */
    public TripResponse create(TripRequest request) {
        requireNotInPast(request.departureDate());
        Trip trip = new Trip();
        apply(request, trip);
        return tripMapper.toResponse(tripRepository.saveAndFlush(trip));
    }

    /**
     * Replaces all editable fields of an existing trip. A past departure date may
     * be kept (so past trips stay editable), but a changed date must be today or later.
     */
    public TripResponse update(Long id, TripRequest request) {
        Trip trip = getTrip(id);
        if (!request.departureDate().equals(trip.getDepartureDate())) {
            requireNotInPast(request.departureDate());
        }
        apply(request, trip);
        // Flush so that @UpdateTimestamp is applied before the response is built.
        return tripMapper.toResponse(tripRepository.saveAndFlush(trip));
    }

    public void delete(Long id) {
        Trip trip = tripRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));
        tripRepository.delete(trip);
    }

    private Trip getTrip(Long id) {
        return tripRepository.findWithCitiesById(id)
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));
    }

    private void requireNotInPast(LocalDate departureDate) {
        if (departureDate.isBefore(LocalDate.now(clock))) {
            throw new FieldValidationException("departureDate", "must be today or later");
        }
    }

    private void apply(TripRequest request, Trip trip) {
        if (request.originCityId().equals(request.destinationCityId())) {
            throw new FieldValidationException("destinationCityId", "must differ from originCityId");
        }
        City origin = findCity("originCityId", request.originCityId());
        City destination = findCity("destinationCityId", request.destinationCityId());
        tripMapper.updateEntity(trip, request, origin, destination);
    }

    private City findCity(String field, Long cityId) {
        return cityRepository.findById(cityId)
                .orElseThrow(() -> new FieldValidationException(field, "unknown city id " + cityId));
    }
}
