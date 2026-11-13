package com.routewise.advisor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import com.routewise.city.dto.CitySummary;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ItineraryTotalsResponse;
import com.routewise.comparison.dto.LegResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.ModeTotalsResponse;
import com.routewise.comparison.dto.WeatherSummary;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.WeatherHazard;

public final class AdvisorTestData {

    /** Wednesday. */
    public static final LocalDate TODAY = LocalDate.of(2026, 11, 11);
    public static final LocalDate DEPARTURE = LocalDate.of(2026, 11, 20);

    public static final CitySummary BERLIN = new CitySummary(1L, "Berlin", "DE");
    public static final CitySummary PRAGUE = new CitySummary(3L, "Prague", "CZ");
    public static final CitySummary VIENNA = new CitySummary(2L, "Vienna", "AT");

    private AdvisorTestData() {
    }

    public static ModeOptionResponse train(boolean recommended) {
        return new ModeOptionResponse(TransportModeCode.TRAIN, true, null, null, new BigDecimal("628.3"), 373,
                new BigDecimal("150.80"), new BigDecimal("44.0"), 87, recommended, List.of());
    }

    public static ModeOptionResponse bus() {
        return new ModeOptionResponse(TransportModeCode.BUS, true, null, null, new BigDecimal("680.7"), 453,
                new BigDecimal("90.80"), new BigDecimal("54.0"), 71, false, List.of());
    }

    public static ModeOptionResponse bikeUnavailable() {
        return new ModeOptionResponse(TransportModeCode.BIKE, false,
                UnavailableCode.TOO_FAR, "Route of 681 km exceeds the BIKE limit of 150 km", new BigDecimal("680.7"),
                null, null, null, 0, false, List.of());
    }

    public static WeatherSummary rainInVienna() {
        return new WeatherSummary("Vienna", DEPARTURE, "Rain", 4.0, 9.0, 90, 20.0, Set.of(WeatherHazard.RAIN));
    }

    /** One leg, Berlin to Vienna, with the given options; totals follow from the options. */
    public static ComparisonResponse comparison(List<WeatherSummary> weather, ModeOptionResponse... options) {
        LegResponse leg = leg(0, BERLIN, VIENNA, "523.6", options);
        return new ComparisonResponse(1L, DEPARTURE, 2, TripPriority.GREENEST, new BigDecimal("523.6"), "EUR",
                weather, List.of(leg), itinerary(List.of(leg)), singleModeTotals(List.of(options)));
    }

    /** Train recommended, bus as alternative, bike unavailable, rain in Vienna. */
    public static ComparisonResponse berlinToVienna() {
        return comparison(List.of(rainInVienna()), train(true), bus(), bikeUnavailable());
    }

    /**
     * Two legs, BALANCED: Berlin to Prague (train 240 min, 40.00, 10.0 kg recommended; bus 300 min, 20.00,
     * 8.0 kg) and Prague to Vienna (bus 270 min, 18.00, 7.0 kg recommended; train 250 min, 45.00, 9.0 kg).
     * Plan: train then bus, 510 min, 58.00, 17.0 kg. Train throughout: 490 min, 85.00, 19.0 kg;
     * bus throughout: 570 min, 38.00, 15.0 kg.
     */
    public static ComparisonResponse berlinPragueVienna() {
        LegResponse first = leg(0, BERLIN, PRAGUE, "280.0",
                option(TransportModeCode.TRAIN, 240, "40.00", "10.0", true),
                option(TransportModeCode.BUS, 300, "20.00", "8.0", false));
        LegResponse second = leg(1, PRAGUE, VIENNA, "252.0",
                option(TransportModeCode.BUS, 270, "18.00", "7.0", true),
                option(TransportModeCode.TRAIN, 250, "45.00", "9.0", false));
        return new ComparisonResponse(1L, DEPARTURE, 2, TripPriority.BALANCED, new BigDecimal("532.0"), "EUR",
                List.of(), List.of(first, second),
                new ItineraryTotalsResponse(List.of(TransportModeCode.TRAIN, TransportModeCode.BUS), 510,
                        new BigDecimal("58.00"), new BigDecimal("17.0")),
                List.of(new ModeTotalsResponse(TransportModeCode.TRAIN, true, null, null, 490, new BigDecimal("85.00"),
                                new BigDecimal("19.0")),
                        new ModeTotalsResponse(TransportModeCode.BUS, true, null, null, 570, new BigDecimal("38.00"),
                                new BigDecimal("15.0"))));
    }

    public static ModeOptionResponse option(TransportModeCode mode, int minutes, String cost, String co2,
                                            boolean recommended) {
        return new ModeOptionResponse(mode, true, null, null, new BigDecimal("300.0"), minutes, new BigDecimal(cost),
                new BigDecimal(co2), recommended ? 80 : 60, recommended, List.of());
    }

    private static LegResponse leg(int index, CitySummary from, CitySummary to, String distanceKm,
                                   ModeOptionResponse... options) {
        TransportModeCode recommended = Arrays.stream(options).filter(ModeOptionResponse::recommended)
                .map(ModeOptionResponse::mode).findFirst().orElse(null);
        return new LegResponse(index, from, to, new BigDecimal(distanceKm), List.of(options), recommended);
    }

    private static ItineraryTotalsResponse itinerary(List<LegResponse> legs) {
        if (legs.stream().anyMatch(leg -> leg.recommendedMode() == null)) {
            return null;
        }
        List<ModeOptionResponse> chosen = legs.stream()
                .map(leg -> leg.options().stream().filter(ModeOptionResponse::recommended).findFirst().orElseThrow())
                .toList();
        return new ItineraryTotalsResponse(chosen.stream().map(ModeOptionResponse::mode).toList(),
                chosen.stream().mapToInt(ModeOptionResponse::durationMinutes).sum(),
                chosen.stream().map(ModeOptionResponse::totalCost).reduce(BigDecimal.ZERO, BigDecimal::add),
                chosen.stream().map(ModeOptionResponse::co2Kg).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private static List<ModeTotalsResponse> singleModeTotals(List<ModeOptionResponse> options) {
        return options.stream()
                .map(option -> option.available()
                        ? new ModeTotalsResponse(option.mode(), true, null, null, option.durationMinutes(),
                                option.totalCost(), option.co2Kg())
                        : new ModeTotalsResponse(option.mode(), false, option.unavailableCode(), "Leg 1 (Berlin to Vienna): "
                                + option.unavailableReason(), null, null, null))
                .toList();
    }
}
