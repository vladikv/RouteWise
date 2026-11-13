package com.routewise.comparison.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Optional;

import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.transportmode.domain.TransportModeCode;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class ModeAvailabilityTest {

    private static final int LIMIT_KM = 2000;

    @ParameterizedTest
    @EnumSource(value = TransportModeCode.class, names = "PLANE", mode = EnumSource.Mode.EXCLUDE)
    void check_groundModeOnSameLandmassWithinLimit_isAvailable(TransportModeCode code) {
        assertThat(ModeAvailability.check(mode(code), 1000, true)).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(value = TransportModeCode.class, names = "PLANE", mode = EnumSource.Mode.EXCLUDE)
    void check_groundModeOnSameLandmassBeyondLimit_isTooFar(TransportModeCode code) {
        Optional<ModeAvailability.Unavailable> result = ModeAvailability.check(mode(code), 2500, true);

        assertThat(result).get().satisfies(why -> {
            assertThat(why.code()).isEqualTo(UnavailableCode.TOO_FAR);
            assertThat(why.reason()).isEqualTo("Route of 2500 km exceeds the %s limit of 2000 km".formatted(code));
        });
    }

    @ParameterizedTest
    @EnumSource(value = TransportModeCode.class, names = "PLANE", mode = EnumSource.Mode.EXCLUDE)
    void check_groundModeOnDifferentLandmassAndShortRoute_isDifferentLandmass(TransportModeCode code) {
        Optional<ModeAvailability.Unavailable> result = ModeAvailability.check(mode(code), 100, false);

        assertThat(result).get().satisfies(why -> {
            assertThat(why.code()).isEqualTo(UnavailableCode.DIFFERENT_LANDMASS);
            assertThat(why.reason()).isEqualTo("No land route between the cities for " + code);
        });
    }

    @Test
    void check_planeAcrossLandmasses_isAvailable() {
        assertThat(ModeAvailability.check(mode(TransportModeCode.PLANE), 1000, false)).isEmpty();
    }

    @Test
    void check_planeBeyondItsLimit_isTooFar() {
        assertThat(ModeAvailability.check(mode(TransportModeCode.PLANE), LIMIT_KM + 1, false))
                .get().extracting(ModeAvailability.Unavailable::code).isEqualTo(UnavailableCode.TOO_FAR);
    }

    @Test
    void check_routeExactlyAtTheLimit_isAvailable() {
        assertThat(ModeAvailability.check(mode(TransportModeCode.TRAIN), LIMIT_KM, true)).isEmpty();
    }

    @Test
    void check_routeJustAboveTheLimit_isTooFar() {
        assertThat(ModeAvailability.check(mode(TransportModeCode.TRAIN), LIMIT_KM + 0.1, true))
                .get().extracting(ModeAvailability.Unavailable::code).isEqualTo(UnavailableCode.TOO_FAR);
    }

    @Test
    void check_differentLandmassAndTooFar_landmassTakesPrecedence() {
        assertThat(ModeAvailability.check(mode(TransportModeCode.TRAIN), 9000, false))
                .get().extracting(ModeAvailability.Unavailable::code).isEqualTo(UnavailableCode.DIFFERENT_LANDMASS);
    }

    private static ModeParameters mode(TransportModeCode code) {
        return new ModeParameters(code, 100, new BigDecimal("0.100"), 10, 10, LIMIT_KM, null);
    }
}
