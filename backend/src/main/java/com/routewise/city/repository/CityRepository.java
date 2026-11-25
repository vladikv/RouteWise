package com.routewise.city.repository;

import java.util.List;

import com.routewise.city.domain.City;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CityRepository extends JpaRepository<City, Long> {

    List<City> findAllByOrderByNameAsc();

    List<City> findByNameContainingIgnoreCaseOrderByNameAsc(String name);

    /** The hub cities for connecting flights, by name. */
    List<City> findByHubTrueOrderByNameAsc();
}
