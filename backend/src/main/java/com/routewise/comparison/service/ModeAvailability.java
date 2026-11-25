package com.routewise.comparison.service;

import java.util.List;
import java.util.Optional;

import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Pure rule: whether a mode can be used on one leg. Ground modes need both cities on the
 * same landmass and the plane needs a working airport in both (these are checked first);
 * every mode needs a route within its maximum distance.
 */
public final class ModeAvailability {

    private ModeAvailability() {
    }

    /** Why a mode is unavailable: a machine-readable code and a readable reason. */
    public record Unavailable(UnavailableCode code, String reason) {
    }

    /**
     * @param routeKm              the distance checked against the mode's maximum: the route distance (detour
     *                             factor applied), or the longest flight of a connecting plane
     * @param sameLandmass         whether both cities of the leg share a landmass
     * @param citiesWithoutAirport names of the leg's cities without a working airport
     * @return empty when the mode is available
     */
    public static Optional<Unavailable> check(ModeParameters mode, double routeKm, boolean sameLandmass,
                                              List<String> citiesWithoutAirport) {
        if (isGround(mode.code()) && !sameLandmass) {
            return Optional.of(new Unavailable(UnavailableCode.DIFFERENT_LANDMASS,
                    "No land route between the cities for %s".formatted(mode.code())));
        }
        if (!isGround(mode.code()) && !citiesWithoutAirport.isEmpty()) {
            return Optional.of(new Unavailable(UnavailableCode.NO_AIRPORT, noAirportReason(citiesWithoutAirport)));
        }
        if (routeKm > mode.maxDistanceKm()) {
            return Optional.of(new Unavailable(UnavailableCode.TOO_FAR,
                    "Route of %d km exceeds the %s limit of %d km"
                            .formatted(Math.round(routeKm), mode.code(), mode.maxDistanceKm())));
        }
        return Optional.empty();
    }

    /** "No working airport in Kharkiv", or "... in Kyiv and Kharkiv" when neither city of the leg has one. */
    static String noAirportReason(List<String> citiesWithoutAirport) {
        return "No working airport in %s".formatted(String.join(" and ", citiesWithoutAirport));
    }

    static boolean isGround(TransportModeCode mode) {
        return mode != TransportModeCode.PLANE;
    }
}
