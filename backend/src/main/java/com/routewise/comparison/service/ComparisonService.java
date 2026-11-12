package com.routewise.comparison.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.routewise.city.domain.City;
import com.routewise.city.dto.CitySummary;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.comparison.domain.ComparisonInput;
import com.routewise.comparison.domain.Leg;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.dto.ComparisonRequest;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.mapper.ComparisonMapper;
import com.routewise.transportmode.repository.TransportModeRepository;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.repository.TripRepository;
import com.routewise.trip.service.StopResolver;
import com.routewise.weather.domain.Location;
import com.routewise.weather.domain.LocationForecast;
import com.routewise.weather.service.WeatherService;

import org.springframework.stereotype.Service;

/**
 * Compares transport modes leg by leg for a stored trip or for an ad-hoc route:
 * fetches weather once for all stop cities, runs the {@link ComparisonEngine} per leg
 * (with that leg's weather) and combines the legs with the {@link ItineraryCalculator}.
 * Deliberately not transactional: no database transaction stays open during
 * the weather HTTP calls. The repository loads the trip with its stops and cities.
 */
@Service
public class ComparisonService {

    private final TripRepository tripRepository;
    private final StopResolver stopResolver;
    private final TransportModeRepository transportModeRepository;
    private final WeatherService weatherService;
    private final ComparisonEngine comparisonEngine;
    private final ItineraryCalculator itineraryCalculator;
    private final ComparisonMapper comparisonMapper;
    private final Clock clock;

    public ComparisonService(TripRepository tripRepository, StopResolver stopResolver,
                             TransportModeRepository transportModeRepository, WeatherService weatherService,
                             ComparisonEngine comparisonEngine, ItineraryCalculator itineraryCalculator,
                             ComparisonMapper comparisonMapper, Clock clock) {
        this.tripRepository = tripRepository;
        this.stopResolver = stopResolver;
        this.transportModeRepository = transportModeRepository;
        this.weatherService = weatherService;
        this.comparisonEngine = comparisonEngine;
        this.itineraryCalculator = itineraryCalculator;
        this.comparisonMapper = comparisonMapper;
        this.clock = clock;
    }

    /** Someone else's trip is "not found", like a missing one. */
    public ComparisonResponse compare(Long tripId, Long ownerId) {
        Trip trip = tripRepository.findWithStopsByIdAndOwnerId(tripId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip", tripId));
        return compare(trip.getId(), trip.stopCities(), trip.getDepartureDate(), trip.getTravelers(),
                trip.getPriority());
    }

    /**
     * Compares modes for stops that are not stored as a trip; the response has no trip id.
     *
     * @throws FieldValidationException for a past date, an unknown city or two consecutive equal stops
     */
    public ComparisonResponse preview(ComparisonRequest request) {
        if (request.departureDate().isBefore(LocalDate.now(clock))) {
            throw new FieldValidationException("departureDate", "must be today or later");
        }
        List<City> stops = stopResolver.resolve(request.stops());
        return compare(null, stops, request.departureDate(), request.travelers(), request.priority());
    }

    private ComparisonResponse compare(Long tripId, List<City> stops, LocalDate departureDate, int travelers,
                                       TripPriority priority) {
        List<ModeParameters> modes = transportModeRepository.findAll().stream()
                .map(comparisonMapper::toParameters)
                .toList();
        List<LocationForecast> forecasts = weatherService.forecasts(distinctLocations(stops), departureDate);

        List<Leg> legs = new ArrayList<>();
        for (int i = 0; i + 1 < stops.size(); i++) {
            City from = stops.get(i);
            City to = stops.get(i + 1);
            double distanceKm = GeoDistance.haversineKm(from.getLatitude(), from.getLongitude(),
                    to.getLatitude(), to.getLongitude());
            List<LocationForecast> legWeather = forecasts.stream()
                    .filter(f -> f.location().name().equals(from.getName())
                            || f.location().name().equals(to.getName()))
                    .toList();
            List<ModeOption> options = comparisonEngine.compare(
                    new ComparisonInput(distanceKm, travelers, priority, modes, legWeather));
            legs.add(new Leg(summary(from), summary(to), distanceKm, options));
        }
        return comparisonMapper.toResponse(tripId, departureDate, travelers, priority, forecasts, legs,
                itineraryCalculator.recommendedItinerary(legs).orElse(null),
                itineraryCalculator.singleModeTotals(legs));
    }

    /** Each stop city once, in route order (a round trip visits its first city twice). */
    private static List<Location> distinctLocations(List<City> stops) {
        Map<Long, Location> locations = new LinkedHashMap<>();
        stops.forEach(city -> locations.putIfAbsent(city.getId(),
                new Location(city.getName(), city.getLatitude(), city.getLongitude())));
        return List.copyOf(locations.values());
    }

    private static CitySummary summary(City city) {
        return new CitySummary(city.getId(), city.getName(), city.getCountry());
    }
}
