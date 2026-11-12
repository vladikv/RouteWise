package com.routewise.comparison.domain;

import java.util.List;
import java.util.Optional;

import com.routewise.city.dto.CitySummary;

/**
 * One leg of a route (stop i to stop i+1) with the engine's options for it,
 * best available first.
 */
public record Leg(CitySummary from, CitySummary to, double greatCircleKm, List<ModeOption> options) {

    /** The leg's recommended option, if any mode is available. */
    public Optional<ModeOption> recommended() {
        return options.stream().filter(ModeOption::recommended).findFirst();
    }
}
