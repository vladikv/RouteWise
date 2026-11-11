package com.routewise.comparison.service;

import com.routewise.trip.domain.TripPriority;

/**
 * Relative importance of time, cost and CO2 for a trip priority; weights sum to 1.
 */
record ScoreWeights(double time, double cost, double co2) {

    private static final double MAIN = 0.6;
    private static final double SIDE = 0.2;
    private static final double EQUAL = 1.0 / 3;

    static ScoreWeights forPriority(TripPriority priority) {
        return switch (priority) {
            case FASTEST -> new ScoreWeights(MAIN, SIDE, SIDE);
            case CHEAPEST -> new ScoreWeights(SIDE, MAIN, SIDE);
            case GREENEST -> new ScoreWeights(SIDE, SIDE, MAIN);
            case BALANCED -> new ScoreWeights(EQUAL, EQUAL, EQUAL);
        };
    }
}
