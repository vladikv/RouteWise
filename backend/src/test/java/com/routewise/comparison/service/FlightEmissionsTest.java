package com.routewise.comparison.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import com.routewise.comparison.domain.ModeParameters;
import com.routewise.transportmode.domain.TransportModeCode;

import org.junit.jupiter.api.Test;

class FlightEmissionsTest {

    private static final ModeParameters PLANE = new ModeParameters(TransportModeCode.PLANE, 750,
            new BigDecimal("0.150"), 183, 150, 20100, 200);
    private static final ModeParameters TRAIN = new ModeParameters(TransportModeCode.TRAIN, 110,
            new BigDecimal("0.120"), 35, 30, 2000, null);

    @Test
    void co2GramsPerKm_belowThreshold_usesShortHaulFactor() {
        assertThat(FlightEmissions.co2GramsPerKm(PLANE, 1000)).isEqualTo(183);
    }

    @Test
    void co2GramsPerKm_zeroDistance_usesShortHaulFactor() {
        assertThat(FlightEmissions.co2GramsPerKm(PLANE, 0)).isEqualTo(183);
    }

    @Test
    void co2GramsPerKm_exactlyAtThreshold_usesShortHaulFactor() {
        assertThat(FlightEmissions.co2GramsPerKm(PLANE, 3700)).isEqualTo(183);
    }

    @Test
    void co2GramsPerKm_justAboveThreshold_usesLongHaulFactor() {
        assertThat(FlightEmissions.co2GramsPerKm(PLANE, 3700.1)).isEqualTo(200);
    }

    @Test
    void co2GramsPerKm_modeWithoutLongHaulFactor_alwaysUsesRegularFactor() {
        assertThat(FlightEmissions.co2GramsPerKm(TRAIN, 100)).isEqualTo(35);
        assertThat(FlightEmissions.co2GramsPerKm(TRAIN, 9000)).isEqualTo(35);
    }
}
