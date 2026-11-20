package com.routewise.comparison.domain;

/** Where an option's cost comes from. */
public enum CostSource {
    /** Seeded regional prices ({@code CostModel}). */
    ESTIMATE,
    /** The cheapest live flight offer for the leg's airports and date (plane only). */
    LIVE
}
