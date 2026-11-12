package com.routewise.comparison.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import com.routewise.city.domain.City;
import com.routewise.city.repository.CityRepository;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.comparison.domain.ComparisonInput;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.dto.ComparisonRequest;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.mapper.ComparisonMapper;
import com.routewise.transportmode.repository.TransportModeRepository;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.repository.TripRepository;
import com.routewise.weather.domain.Location;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.service.WeatherService;

import org.springframework.stereotype.Service;

/**
 * Compares transport modes for a stored trip or for an ad-hoc route: fetches
 * weather and runs the {@link ComparisonEngine}.
 * Deliberately not transactional: no database transaction stays open during
 * the weather HTTP calls. The repository loads the trip with its cities.
 */
@Service
public class ComparisonService {

    private final TripRepository tripRepository;
    private final CityRepository cityRepository;
    private final TransportModeRepository transportModeRepository;
    private final WeatherService weatherService;
    private final ComparisonEngine comparisonEngine;
    private final ComparisonMapper comparisonMapper;
    private final Clock clock;

    public ComparisonService(TripRepository tripRepository, CityRepository cityRepository,
                             TransportModeRepository transportModeRepository, WeatherService weatherService,
                             ComparisonEngine comparisonEngine, ComparisonMapper comparisonMapper, Clock clock) {
        this.tripRepository = tripRepository;
        this.cityRepository = cityRepository;
        this.transportModeRepository = transportModeRepository;
        this.weatherService = weatherService;
        this.comparisonEngine = comparisonEngine;
        this.comparisonMapper = comparisonMapper;
        this.clock = clock;
    }

    /** Someone else's trip is "not found", like a missing one. */
    public ComparisonResponse compare(Long tripId, Long ownerId) {
        Trip trip = tripRepository.findWithCitiesByIdAndOwnerId(tripId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip", tripId));
        return compare(trip.getId(), trip.getOrigin(), trip.getDestination(), trip.getDepartureDate(),
                trip.getTravelers(), trip.getPriority());
    }

    /**
     * Compares modes for a route that is not stored as a trip; the response has no trip id.
     *
     * @throws FieldValidationException for an unknown city, identical cities or a past date
     */
    public ComparisonResponse preview(ComparisonRequest request) {
        if (request.originCityId().equals(request.destinationCityId())) {
            throw new FieldValidationException("destinationCityId", "must differ from originCityId");
        }
        if (request.departureDate().isBefore(LocalDate.now(clock))) {
            throw new FieldValidationException("departureDate", "must be today or later");
        }
        City origin = findCity("originCityId", request.originCityId());
        City destination = findCity("destinationCityId", request.destinationCityId());
        return compare(null, origin, destination, request.departureDate(), request.travelers(),
                request.priority());
    }

    private ComparisonResponse compare(Long tripId, City origin, City destination, LocalDate departureDate,
                                       int travelers, TripPriority priority) {
        List<ModeParameters> modes = transportModeRepository.findAll().stream()
                .map(comparisonMapper::toParameters)
                .toList();
        double distanceKm = GeoDistance.haversineKm(origin.getLatitude(), origin.getLongitude(),
                destination.getLatitude(), destination.getLongitude());
        List<LocationForecast> forecasts = weatherService.forecasts(
                List.of(toLocation(origin), toLocation(destination)), departureDate);

        List<ModeOption> options = comparisonEngine.compare(
                new ComparisonInput(distanceKm, travelers, priority, modes, forecasts));
        return comparisonMapper.toResponse(tripId, departureDate, travelers, priority, distanceKm, forecasts,
                options);
    }

    private City findCity(String field, Long cityId) {
        return cityRepository.findById(cityId)
                .orElseThrow(() -> new FieldValidationException(field, "unknown city id " + cityId));
    }

    private static Location toLocation(City city) {
        return new Location(city.getName(), city.getLatitude(), city.getLongitude());
    }
}
