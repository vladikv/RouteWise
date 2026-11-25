package com.routewise.comparison.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;

import com.routewise.city.domain.City;
import com.routewise.city.dto.CitySummary;
import com.routewise.city.repository.CityRepository;
import com.routewise.comparison.domain.Leg;
import com.routewise.comparison.domain.ModeOption;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.domain.ModeTotals;
import com.routewise.comparison.domain.PlaneFares;
import com.routewise.comparison.domain.RoutePlan;
import com.routewise.comparison.domain.RouteStop;
import com.routewise.comparison.mapper.ComparisonMapper;
import com.routewise.pricing.domain.PriceBook;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.transportmode.repository.TransportModeRepository;
import com.routewise.trip.domain.TripPriority;

import org.assertj.core.data.Offset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

/**
 * Plans legs between seeded cities with the seeded hubs and modes (real Flyway data).
 */
@DataJpaTest
@Import({HubDirectory.class, RoutePlanner.class, ComparisonEngine.class, ItineraryCalculator.class,
        UnavailableGrouper.class, ComparisonMapper.class})
class HubConnectionPlanningTest {

    @Autowired
    private CityRepository cityRepository;

    @Autowired
    private TransportModeRepository transportModeRepository;

    @Autowired
    private HubDirectory hubDirectory;

    @Autowired
    private RoutePlanner routePlanner;

    @Autowired
    private ComparisonMapper comparisonMapper;

    @Test
    void plan_berlinToSydney_fliesViaHongKongWithFiguresPerFlight() {
        // Direct about 16,094 km, beyond the 12,000 km non-stop limit. Via Hong Kong: Berlin-Hong Kong about
        // 8,749 km and Hong Kong-Sydney about 7,376 km, 16,125 km in all (the smallest total; Bangkok 16,140).
        // Both flights are long haul (200 g): 16,125 x 200 g = 3,225 kg. Time: 150 + 120 + 16,125 / 750 x 60
        // (1,290) = 1,560 min.
        ModeOption plane = planeOption("Berlin", "Sydney");

        assertThat(plane.available()).isTrue();
        assertThat(plane.via().hub().name()).isEqualTo("Hong Kong");
        assertThat(plane.via().airportCode()).isEqualTo("HKG");
        assertThat(plane.routeKm()).isCloseTo(16125, Offset.offset(1.0));
        assertThat(plane.durationMinutes()).isCloseTo(1560, Offset.offset(1));
        assertThat(plane.co2Kg().doubleValue()).isCloseTo(3225, Offset.offset(1.0));
    }

    @Test
    void plan_berlinToNewYork_staysADirectFlight() {
        // About 6,385 km, within the non-stop limit.
        assertThat(planeOption("Berlin", "New York").via()).isNull();
    }

    @Test
    void hubs_allHaveAnAirport() {
        assertThat(hubDirectory.hubs()).isNotEmpty().allSatisfy(hub -> assertThat(hub.hasAirport()).isTrue());
    }

    @Test
    void plan_multiLegTrip_connectsOnlyTheLegBeyondTheLimit() {
        // Berlin-Sydney (about 16,094 km) connects; Sydney-Melbourne (about 714 km) is a direct flight.
        RoutePlan plan = plan("Berlin", "Sydney", "Melbourne");

        assertThat(plan.legs()).extracting(leg -> plane(leg).via() == null ? null : plane(leg).via().hub().name())
                .containsExactly("Hong Kong", null);
        ModeTotals planeTotals = plan.singleModeTotals().stream()
                .filter(totals -> totals.mode() == TransportModeCode.PLANE)
                .findFirst()
                .orElseThrow();
        assertThat(planeTotals.totals().durationMinutes())
                .isEqualTo(plane(plan.legs().get(0)).durationMinutes() + plane(plan.legs().get(1)).durationMinutes());
    }

    private ModeOption planeOption(String from, String to) {
        return plane(plan(from, to).legs().getFirst());
    }

    private RoutePlan plan(String... cities) {
        List<ModeParameters> modes = transportModeRepository.findAll().stream()
                .map(comparisonMapper::toParameters)
                .toList();
        List<RouteStop> stops = Arrays.stream(cities).map(this::stop).toList();
        return routePlanner.plan(stops, 1, TripPriority.BALANCED, modes, PriceBook.EMPTY, PlaneFares.NONE,
                hubDirectory.hubs(), List.of());
    }

    private static ModeOption plane(Leg leg) {
        return leg.options().stream()
                .filter(option -> option.mode() == TransportModeCode.PLANE)
                .findFirst()
                .orElseThrow();
    }

    private RouteStop stop(String name) {
        City city = cityRepository.findByNameContainingIgnoreCaseOrderByNameAsc(name).stream()
                .filter(candidate -> candidate.getName().equals(name))
                .findFirst()
                .orElseThrow();
        return new RouteStop(new CitySummary(city.getId(), city.getName(), city.getCountry()), city.getLatitude(),
                city.getLongitude(), city.getLandmass(), city.getAirportCode());
    }
}
