package com.routewise.pricing.service;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

import com.routewise.pricing.domain.CountryPrice;
import com.routewise.pricing.domain.CountryPricing;
import com.routewise.pricing.domain.Fare;
import com.routewise.pricing.domain.PriceBook;
import com.routewise.pricing.domain.RegionalFare;
import com.routewise.pricing.repository.CountryPricingRepository;
import com.routewise.pricing.repository.RegionalFareRepository;
import com.routewise.transportmode.domain.TransportModeCode;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Loads the seeded regional prices as a {@link PriceBook} for the pure cost rules.
 */
@Service
public class PricingService {

    private final CountryPricingRepository countryPricingRepository;
    private final RegionalFareRepository regionalFareRepository;

    public PricingService(CountryPricingRepository countryPricingRepository,
                          RegionalFareRepository regionalFareRepository) {
        this.countryPricingRepository = countryPricingRepository;
        this.regionalFareRepository = regionalFareRepository;
    }

    @Transactional(readOnly = true)
    public PriceBook priceBook() {
        Map<String, CountryPrice> countries = countryPricingRepository.findAll().stream()
                .collect(Collectors.toMap(CountryPricing::getCountry,
                        row -> new CountryPrice(row.getRegion(), row.getFuelEurPerLitre(), row.getTollEurPerKm())));
        Map<String, Map<TransportModeCode, Fare>> fares = new HashMap<>();
        for (RegionalFare row : regionalFareRepository.findAll()) {
            fares.computeIfAbsent(row.getRegion(), region -> new EnumMap<>(TransportModeCode.class))
                    .put(row.getModeCode(), new Fare(row.getBaseFareEur(), row.getCostPerKm()));
        }
        return new PriceBook(countries, fares);
    }
}
