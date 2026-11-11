package com.routewise.comparison.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class GeoDistanceTest {

    @Test
    void haversineKm_berlinToVienna_isAbout524Km() {
        assertThat(GeoDistance.haversineKm(52.5200, 13.4050, 48.2082, 16.3738)).isCloseTo(524, within(2.0));
    }

    @Test
    void haversineKm_isSymmetric() {
        double there = GeoDistance.haversineKm(48.8566, 2.3522, 41.9028, 12.4964);
        double back = GeoDistance.haversineKm(41.9028, 12.4964, 48.8566, 2.3522);
        assertThat(there).isCloseTo(back, within(1e-9));
    }

    @Test
    void haversineKm_samePoint_isZero() {
        assertThat(GeoDistance.haversineKm(52.52, 13.405, 52.52, 13.405)).isZero();
    }
}
