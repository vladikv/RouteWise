package com.routewise.pricing.repository;

import com.routewise.pricing.domain.RegionalFare;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RegionalFareRepository extends JpaRepository<RegionalFare, Long> {
}
