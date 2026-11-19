package com.routewise.pricing.repository;

import com.routewise.pricing.domain.CountryPricing;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CountryPricingRepository extends JpaRepository<CountryPricing, String> {
}
