package com.routewise.transportmode.domain;

import java.math.BigDecimal;

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
 * Seeded reference data (see the V2 migration): the parameters the comparison
 * engine uses per mode. Cost and CO2 are per traveler, except for CAR,
 * where they are per vehicle.
 */
@Entity
@Table(name = "transport_mode")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TransportMode {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private TransportModeCode code;

    @Column(name = "avg_speed_kmh", nullable = false)
    private int avgSpeedKmh;

    @Column(name = "cost_per_km", nullable = false, precision = 6, scale = 3)
    private BigDecimal costPerKm;

    @Column(name = "co2_grams_per_km", nullable = false)
    private int co2GramsPerKm;

    @Column(name = "fixed_overhead_minutes", nullable = false)
    private int fixedOverheadMinutes;

    @Column(name = "max_distance_km", nullable = false)
    private int maxDistanceKm;

    /** PLANE only: CO2 above the long-haul threshold; {@code co2GramsPerKm} is then short-haul. */
    @Column(name = "long_haul_co2_grams_per_km")
    private Integer longHaulCo2GramsPerKm;
}
