package com.routewise.comparison.service;

import java.util.List;

import com.routewise.city.domain.City;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.comparison.domain.ComparisonInput;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.mapper.ComparisonMapper;
import com.routewise.transportmode.repository.TransportModeRepository;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.repository.TripRepository;
import com.routewise.weather.domain.Location;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.service.WeatherService;

import org.springframework.stereotype.Service;

/**
 * Loads a trip, fetches weather and runs the {@link ComparisonEngine}.
 * Deliberately not transactional: no database transaction stays open during
 * the weather HTTP calls. The repository loads the trip with its cities.
 */
@Service
public class ComparisonService {

    private final TripRepository tripRepository;
    private final TransportModeRepository transportModeRepository;
    private final WeatherService weatherService;
    private final ComparisonEngine comparisonEngine;
    private final ComparisonMapper comparisonMapper;

    public ComparisonService(TripRepository tripRepository, TransportModeRepository transportModeRepository,
                             WeatherService weatherService, ComparisonEngine comparisonEngine,
                             ComparisonMapper comparisonMapper) {
        this.tripRepository = tripRepository;
        this.transportModeRepository = transportModeRepository;
        this.weatherService = weatherService;
        this.comparisonEngine = comparisonEngine;
        this.comparisonMapper = comparisonMapper;
    }

    public ComparisonResponse compare(Long tripId) {
        Trip trip = tripRepository.findWithCitiesById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip", tripId));
        List<ModeParameters> modes = transportModeRepository.findAll().stream()
                .map(comparisonMapper::toParameters)
                .toList();
        City origin = trip.getOrigin();
        City destination = trip.getDestination();
        double distanceKm = GeoDistance.haversineKm(origin.getLatitude(), origin.getLongitude(),
                destination.getLatitude(), destination.getLongitude());
        List<LocationForecast> forecasts = weatherService.forecasts(
                List.of(toLocation(origin), toLocation(destination)), trip.getDepartureDate());

        List<ModeOption> options = comparisonEngine.compare(
                new ComparisonInput(distanceKm, trip.getTravelers(), trip.getPriority(), modes, forecasts));
        return comparisonMapper.toResponse(trip, distanceKm, forecasts, options);
    }

    private static Location toLocation(City city) {
        return new Location(city.getName(), city.getLatitude(), city.getLongitude());
    }
}
