package com.routewise.comparison.service;

import java.util.Optional;

import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Pure rule: whether a mode can be used on one leg. Ground modes need both cities on the
 * same landmass (checked first); every mode needs a route within its maximum distance.
 */
public final class ModeAvailability {

    private ModeAvailability() {
    }

    /** Why a mode is unavailable: a machine-readable code and a readable reason. */
    public record Unavailable(UnavailableCode code, String reason) {
    }

    /**
     * @param routeKm      the mode's route distance (detour factor applied)
     * @param sameLandmass whether both cities of the leg share a landmass
     * @return empty when the mode is available
     */
    public static Optional<Unavailable> check(ModeParameters mode, double routeKm, boolean sameLandmass) {
        if (isGround(mode.code()) && !sameLandmass) {
            return Optional.of(new Unavailable(UnavailableCode.DIFFERENT_LANDMASS,
                    "No land route between the cities for %s".formatted(mode.code())));
        }
        if (routeKm > mode.maxDistanceKm()) {
            return Optional.of(new Unavailable(UnavailableCode.TOO_FAR,
                    "Route of %d km exceeds the %s limit of %d km"
                            .formatted(Math.round(routeKm), mode.code(), mode.maxDistanceKm())));
        }
        return Optional.empty();
    }

    static boolean isGround(TransportModeCode mode) {
        return mode != TransportModeCode.PLANE;
    }
}
