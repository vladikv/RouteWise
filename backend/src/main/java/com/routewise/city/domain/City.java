package com.routewise.city.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Seeded reference data (see the V2, V6 and V7 migrations); read-only for the application.
 */
@Entity
@Table(name = "city")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class City {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 2)
    private String country;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Continent continent;

    /** Ground-connected region (fixed links count, ferries do not), e.g. EURASIA or JAPAN. */
    @Column(nullable = false, length = 30)
    private String landmass;

    @Column(nullable = false)
    private boolean capital;

    /** Map label priority: 1 is labelled first, 3 only when zoomed in. */
    @Column(name = "label_rank", nullable = false)
    private int labelRank;
}
