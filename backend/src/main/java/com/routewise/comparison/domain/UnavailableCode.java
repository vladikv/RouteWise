package com.routewise.comparison.domain;

/**
 * Why a transport mode cannot be used on a leg; the API sends it next to the readable reason.
 */
public enum UnavailableCode {
    /** A ground mode between cities that no land route (or fixed link) joins. */
    DIFFERENT_LANDMASS,
    /** The route is longer than the mode's maximum distance. */
    TOO_FAR
}
