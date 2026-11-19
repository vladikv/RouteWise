package com.routewise.pricing.domain;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Seeded reference data (see the V13 migration): a country's fuel price, average toll and fare region.
 */
@Entity
@Table(name = "country_pricing")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CountryPricing {

    /** ISO 3166-1 alpha-2, as in {@code city.country}. */
    @Id
    @Column(length = 2)
    private String country;

    @Column(nullable = false, length = 20)
    private String region;

    @Column(name = "fuel_eur_per_litre", nullable = false, precision = 5, scale = 3)
    private BigDecimal fuelEurPerLitre;

    @Column(name = "toll_eur_per_km", nullable = false, precision = 5, scale = 3)
    private BigDecimal tollEurPerKm;
}
