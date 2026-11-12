package com.routewise.trip.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.routewise.city.domain.City;
import com.routewise.city.repository.CityRepository;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ValidationError;
import com.routewise.trip.dto.TripStopRequest;

import org.springframework.stereotype.Component;

/**
 * Turns a requested stop list into cities, for trips and for unsaved comparisons.
 * The list size (2-10) and non-null ids are checked by Bean Validation on the request.
 */
@Component
public class StopResolver {

    private final CityRepository cityRepository;

    public StopResolver(CityRepository cityRepository) {
        this.cityRepository = cityRepository;
    }

    /**
     * @return the cities in stop order
     * @throws FieldValidationException with one {@code stops[i].cityId} error per bad stop:
     *         an unknown city, or the same city as the stop before it
     */
    public List<City> resolve(List<TripStopRequest> stops) {
        List<Long> ids = stops.stream().map(TripStopRequest::cityId).toList();
        Map<Long, City> cities = cityRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(City::getId, Function.identity()));
        List<ValidationError> errors = new ArrayList<>();
        for (int i = 0; i < ids.size(); i++) {
            String field = "stops[%d].cityId".formatted(i);
            if (!cities.containsKey(ids.get(i))) {
                errors.add(new ValidationError(field, "unknown city id " + ids.get(i)));
            } else if (i > 0 && ids.get(i).equals(ids.get(i - 1))) {
                errors.add(new ValidationError(field, "must differ from the previous stop"));
            }
        }
        if (!errors.isEmpty()) {
            throw new FieldValidationException(errors);
        }
        return ids.stream().map(cities::get).toList();
    }
}
