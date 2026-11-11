package com.routewise.city.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Seeded reference data (see the V2 migration); read-only for the application.
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
}
