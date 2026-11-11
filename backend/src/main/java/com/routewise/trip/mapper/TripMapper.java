package com.routewise.trip.mapper;

import com.routewise.city.domain.City;
import com.routewise.city.mapper.CityMapper;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.dto.TripRequest;
import com.routewise.trip.dto.TripResponse;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class TripMapper {

    private final CityMapper cityMapper;

    public TripMapper(CityMapper cityMapper) {
        this.cityMapper = cityMapper;
    }

    public TripResponse toResponse(Trip trip) {
        return new TripResponse(
                trip.getId(),
                trip.getTitle(),
                cityMapper.toSummary(trip.getOrigin()),
                cityMapper.toSummary(trip.getDestination()),
                trip.getDepartureDate(),
                trip.getTravelers(),
                trip.getPriority(),
                trip.getNotes(),
                trip.getCreatedAt(),
                trip.getUpdatedAt());
    }

    /**
     * Copies the request onto {@code trip}; the cities are resolved by the caller.
     * Blank notes are stored as {@code null}.
     */
    public void updateEntity(Trip trip, TripRequest request, City origin, City destination) {
        trip.setTitle(request.title().strip());
        trip.setOrigin(origin);
        trip.setDestination(destination);
        trip.setDepartureDate(request.departureDate());
        trip.setTravelers(request.travelers());
        trip.setPriority(request.priority());
        trip.setNotes(StringUtils.hasText(request.notes()) ? request.notes().strip() : null);
    }
}
