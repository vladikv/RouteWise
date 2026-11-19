package com.routewise.pricing.domain;

import java.math.BigDecimal;

import com.routewise.transportmode.domain.TransportModeCode;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Seeded reference data (see the V13 migration): the average ticket price per traveler of a mode
 * (TRAIN, BUS or PLANE) in a fare region, as a base fare plus a price per km.
 */
@Entity
@Table(name = "regional_fare")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RegionalFare {

    /** Read-only reference data: rows come from the V13 seed, so no id generation is mapped. */
    @Id
    private Long id;

    @Column(nullable = false, length = 20)
    private String region;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_code", nullable = false, length = 10)
    private TransportModeCode modeCode;

    @Column(name = "base_fare_eur", nullable = false, precision = 6, scale = 2)
    private BigDecimal baseFareEur;

    @Column(name = "cost_per_km", nullable = false, precision = 6, scale = 3)
    private BigDecimal costPerKm;
}
