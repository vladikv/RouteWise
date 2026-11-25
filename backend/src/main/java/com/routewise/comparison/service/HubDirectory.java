package com.routewise.comparison.service;

import java.util.List;

import com.routewise.city.dto.CitySummary;
import com.routewise.city.repository.CityRepository;
import com.routewise.comparison.domain.RouteStop;

import org.springframework.stereotype.Service;

/**
 * Loads the seeded hub cities as route stops, once per request, for {@link RoutePlanner}. A hub always
 * has an airport (V16 check); the filter keeps {@link HubRouter} safe even if the data says otherwise.
 */
@Service
public class HubDirectory {

    private final CityRepository cityRepository;

    public HubDirectory(CityRepository cityRepository) {
        this.cityRepository = cityRepository;
    }

    public List<RouteStop> hubs() {
        return cityRepository.findByHubTrueOrderByNameAsc().stream()
                .map(city -> new RouteStop(new CitySummary(city.getId(), city.getName(), city.getCountry()),
                        city.getLatitude(), city.getLongitude(), city.getLandmass(), city.getAirportCode()))
                .filter(RouteStop::hasAirport)
                .toList();
    }
}
