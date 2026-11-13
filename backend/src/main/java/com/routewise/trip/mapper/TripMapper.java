package com.routewise.trip.mapper;

import java.util.List;

import com.routewise.city.domain.City;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripFigures;
import com.routewise.trip.domain.TripStop;
import com.routewise.trip.dto.TripFiguresResponse;
import com.routewise.trip.dto.TripListItemResponse;
import com.routewise.trip.dto.TripRequest;
import com.routewise.trip.dto.TripResponse;
import com.routewise.trip.dto.TripStopResponse;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class TripMapper {

    public TripResponse toResponse(Trip trip) {
        return new TripResponse(
                trip.getId(),
                trip.getTitle(),
                trip.getStops().stream().map(TripMapper::toResponse).toList(),
                trip.getDepartureDate(),
                trip.getTravelers(),
                trip.getPriority(),
                trip.getNotes(),
                trip.getCreatedAt(),
                trip.getUpdatedAt());
    }

    /** The trip with its list figures; {@code figures} may be {@code null}. */
    public TripListItemResponse toListItem(Trip trip, TripFigures figures) {
        return new TripListItemResponse(
                trip.getId(),
                trip.getTitle(),
                trip.getStops().stream().map(TripMapper::toResponse).toList(),
                trip.getDepartureDate(),
                trip.getTravelers(),
                trip.getPriority(),
                trip.getNotes(),
                trip.getCreatedAt(),
                trip.getUpdatedAt(),
                figures == null ? null : new TripFiguresResponse(figures.totalCost(), figures.co2Kg(),
                        figures.carCo2Kg(), figures.co2VsCarPercent(), figures.co2ShareOfCar(), figures.modes(),
                        figures.legModes()));
    }

    /**
     * Copies the request onto {@code trip}; the stop cities are resolved by the caller.
     * Blank notes are stored as {@code null}.
     */
    public void updateEntity(Trip trip, TripRequest request, List<City> stopCities) {
        trip.setTitle(request.title().strip());
        trip.replaceStops(stopCities);
        trip.setDepartureDate(request.departureDate());
        trip.setTravelers(request.travelers());
        trip.setPriority(request.priority());
        trip.setNotes(StringUtils.hasText(request.notes()) ? request.notes().strip() : null);
    }

    private static TripStopResponse toResponse(TripStop stop) {
        City city = stop.getCity();
        return new TripStopResponse(city.getId(), city.getName(), city.getCountry(), stop.getPosition());
    }
}
