package com.routewise.city.mapper;

import com.routewise.city.domain.City;
import com.routewise.city.dto.CityResponse;
import com.routewise.city.dto.CitySummary;

import org.springframework.stereotype.Component;

@Component
public class CityMapper {

    public CityResponse toResponse(City city) {
        return new CityResponse(city.getId(), city.getName(), city.getCountry(),
                city.getLatitude(), city.getLongitude());
    }

    public CitySummary toSummary(City city) {
        return new CitySummary(city.getId(), city.getName(), city.getCountry());
    }
}
