package com.routewise.trip.domain;

/** Limits for a trip's stop list, shared by requests, validation and the advisor. */
public final class TripStops {

    public static final int MIN = 2;
    public static final int MAX = 10;

    private TripStops() {
    }
}
