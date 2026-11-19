package com.routewise.pricing;

import java.math.BigDecimal;

import com.routewise.pricing.domain.CountryPricing;
import com.routewise.pricing.domain.RegionalFare;
import com.routewise.transportmode.domain.TransportModeCode;

import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Builds the read-only pricing entities for unit tests (they have no public constructor or setters).
 */
public final class TestPricing {

    private TestPricing() {
    }

    public static CountryPricing country(String code, String region, String fuel, String toll) {
        CountryPricing row = BeanUtils.instantiateClass(CountryPricing.class);
        ReflectionTestUtils.setField(row, "country", code);
        ReflectionTestUtils.setField(row, "region", region);
        ReflectionTestUtils.setField(row, "fuelEurPerLitre", new BigDecimal(fuel));
        ReflectionTestUtils.setField(row, "tollEurPerKm", new BigDecimal(toll));
        return row;
    }

    public static RegionalFare fare(String region, TransportModeCode mode, String base, String perKm) {
        RegionalFare row = BeanUtils.instantiateClass(RegionalFare.class);
        ReflectionTestUtils.setField(row, "region", region);
        ReflectionTestUtils.setField(row, "modeCode", mode);
        ReflectionTestUtils.setField(row, "baseFareEur", new BigDecimal(base));
        ReflectionTestUtils.setField(row, "costPerKm", new BigDecimal(perKm));
        return row;
    }
}
