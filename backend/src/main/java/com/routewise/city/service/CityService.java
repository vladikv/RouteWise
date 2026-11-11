package com.routewise.city.service;

import java.util.List;

import com.routewise.city.domain.City;
import com.routewise.city.dto.CityResponse;
import com.routewise.city.mapper.CityMapper;
import com.routewise.city.repository.CityRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@Transactional(readOnly = true)
public class CityService {

    private final CityRepository cityRepository;
    private final CityMapper cityMapper;

    public CityService(CityRepository cityRepository, CityMapper cityMapper) {
        this.cityRepository = cityRepository;
        this.cityMapper = cityMapper;
    }

    /**
     * Returns all cities sorted by name, or only those whose name contains
     * {@code query} (case-insensitive) when a non-blank query is given.
     */
    public List<CityResponse> findAll(String query) {
        List<City> cities = StringUtils.hasText(query)
                ? cityRepository.findByNameContainingIgnoreCaseOrderByNameAsc(query.strip())
                : cityRepository.findAllByOrderByNameAsc();
        return cities.stream().map(cityMapper::toResponse).toList();
    }
}
