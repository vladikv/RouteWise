package com.routewise.trip.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.routewise.city.domain.City;
import com.routewise.city.repository.CityRepository;
import com.routewise.common.config.ClockConfig;
import com.routewise.common.config.JpaAuditingConfig;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.comparison.mapper.ComparisonMapper;
import com.routewise.comparison.service.ComparisonEngine;
import com.routewise.comparison.service.ItineraryCalculator;
import com.routewise.comparison.service.RoutePlanner;
import com.routewise.comparison.service.UnavailableGrouper;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.dto.PriorityTotalResponse;
import com.routewise.trip.dto.TripFacetsResponse;
import com.routewise.trip.dto.TripListItemResponse;
import com.routewise.trip.dto.TripPageResponse;
import com.routewise.trip.dto.TripSearchParams;
import com.routewise.trip.mapper.TripMapper;
import com.routewise.trip.repository.TripRepository;
import com.routewise.user.domain.AppUser;
import com.routewise.user.repository.AppUserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;

/**
 * Real seeded transport modes and cities, real figures. Alice's trips (2 travelers each):
 * <pre>
 * Long haul       Berlin - New York   Dec 1   BALANCED  different landmasses: plane only
 * Vienna return   Berlin - Vienna - Berlin  Dec 5   CHEAPEST  two legs, bus (cheapest and lowest CO2)
 * Capitals        Paris - Rome        Dec 10  CHEAPEST  bus
 * Short hop       Berlin - Prague     Dec 20  FASTEST   train
 * </pre>
 * Cost and CO2 grow in the order Short hop, Vienna return, Capitals, Long haul; the date order is
 * the reverse of that for the first and last trip, which is what the sort tests rely on.
 */
@DataJpaTest
@Import({TripQueryService.class, TripFiguresCalculator.class, RoutePlanner.class, ComparisonEngine.class,
        ItineraryCalculator.class, UnavailableGrouper.class, ComparisonMapper.class, TripMapper.class,
        JpaAuditingConfig.class, ClockConfig.class})
class TripQueryServiceTest {

    private static final LocalDate DEC_1 = LocalDate.of(2026, 12, 1);
    private static final LocalDate DEC_5 = LocalDate.of(2026, 12, 5);
    private static final LocalDate DEC_10 = LocalDate.of(2026, 12, 10);
    private static final LocalDate DEC_20 = LocalDate.of(2026, 12, 20);

    private static final String LONG_HAUL = "Long haul";
    private static final String VIENNA_RETURN = "Vienna return";
    private static final String CAPITALS = "Capitals";
    private static final String SHORT_HOP = "Short hop";

    @Autowired
    private TripQueryService service;

    @Autowired
    private TripRepository tripRepository;

    @Autowired
    private CityRepository cityRepository;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private TestEntityManager entityManager;

    private AppUser alice;
    private AppUser bob;

    @BeforeEach
    void createTrips() {
        alice = userRepository.save(user("alice@example.com"));
        bob = userRepository.save(user("bob@example.com"));
        save(alice, LONG_HAUL, DEC_1, TripPriority.BALANCED, "Berlin", "New York");
        save(alice, VIENNA_RETURN, DEC_5, TripPriority.CHEAPEST, "Berlin", "Vienna", "Berlin");
        save(alice, CAPITALS, DEC_10, TripPriority.CHEAPEST, "Paris", "Rome");
        save(alice, SHORT_HOP, DEC_20, TripPriority.FASTEST, "Berlin", "Prague");
        save(bob, "Bob trip", DEC_5, TripPriority.FASTEST, "Berlin", "Prague");
        Trip deleted = trip(alice, "Deleted trip", DEC_5, TripPriority.GREENEST, "Berlin", "Prague");
        deleted.markDeleted(Instant.parse("2026-11-13T10:00:00Z"));
        tripRepository.save(deleted);
        entityManager.flush();
        entityManager.clear();
    }

    @Test
    void search_noParams_returnsAllActiveTripsOfTheOwnerByDateWithDefaults() {
        TripPageResponse page = service.search(params().build(), alice.getId());

        assertThat(titles(page)).containsExactly(LONG_HAUL, VIENNA_RETURN, CAPITALS, SHORT_HOP);
        assertThat(page.page()).isZero();
        assertThat(page.size()).isEqualTo(TripSearchParams.DEFAULT_SIZE);
        assertThat(page.totalItems()).isEqualTo(4);
        assertThat(page.totalPages()).isEqualTo(1);
        assertThat(page.currency()).isEqualTo("EUR");
    }

    @Test
    void search_noParams_itemsCarryFiguresAndStops() {
        TripListItemResponse longHaul = service.search(params().build(), alice.getId()).items().getFirst();

        assertThat(longHaul.stops()).extracting(stop -> stop.cityName()).containsExactly("Berlin", "New York");
        assertThat(longHaul.figures().modes()).containsExactly(TransportModeCode.PLANE);
        assertThat(longHaul.figures().totalCost()).isPositive();
        assertThat(longHaul.figures().co2Kg()).isPositive();
    }

    @Test
    void search_noTrips_returnsEmptyPageWithZeroCounts() {
        AppUser carol = userRepository.save(user("carol@example.com"));

        TripPageResponse page = service.search(params().build(), carol.getId());

        assertThat(page.items()).isEmpty();
        assertThat(page.totalItems()).isZero();
        assertThat(page.totalPages()).isZero();
        assertThat(priorityCounts(page.facets()).values()).containsOnly(0L);
        assertThat(modeCounts(page.facets()).values()).containsOnly(0L);
        assertThat(page.priorityTotals()).allSatisfy(total -> {
            assertThat(total.count()).isZero();
            assertThat(total.totalCost()).isEqualByComparingTo(BigDecimal.ZERO);
        });
    }

    @Test
    void search_unknownOwner_returnsNothing() {
        assertThat(service.search(params().build(), 999_999L).items()).isEmpty();
    }

    @Test
    void search_ownerFilter_doesNotShowOtherUsersTrips() {
        assertThat(titles(service.search(params().build(), bob.getId()))).containsExactly("Bob trip");
    }

    @Test
    void search_deletedTrip_isNotListedNorCounted() {
        TripPageResponse page = service.search(params().build(), alice.getId());

        assertThat(titles(page)).doesNotContain("Deleted trip");
        assertThat(page.totalItems()).isEqualTo(4);
        assertThat(priorityCounts(page.facets()).get(TripPriority.GREENEST)).isZero();
        assertThat(priorityTotals(page).get(TripPriority.GREENEST).count()).isZero();
    }

    @Test
    void search_textInTitle_filters() {
        assertThat(titles(service.search(params().q("capitals").build(), alice.getId())))
                .containsExactly(CAPITALS);
    }

    @Test
    void search_textInStopCityName_filters() {
        assertThat(titles(service.search(params().q("VIENNA").build(), alice.getId())))
                .containsExactly(VIENNA_RETURN);
        assertThat(titles(service.search(params().q("prag").build(), alice.getId())))
                .containsExactly(SHORT_HOP);
    }

    @Test
    void search_blankText_doesNotFilter() {
        assertThat(service.search(params().q("   ").build(), alice.getId()).totalItems()).isEqualTo(4);
    }

    @Test
    void search_textWithoutMatch_returnsEmptyPage() {
        TripPageResponse page = service.search(params().q("zzz").build(), alice.getId());

        assertThat(page.items()).isEmpty();
        assertThat(page.totalItems()).isZero();
    }

    @Test
    void search_singlePriority_filtersItemsButNotItsOwnFacet() {
        TripPageResponse page = service.search(params().priority(TripPriority.FASTEST).build(), alice.getId());

        assertThat(titles(page)).containsExactly(SHORT_HOP);
        assertThat(page.totalItems()).isEqualTo(1);
        // the priority chips ignore the priority filter: still the counts of all four trips
        assertThat(priorityCounts(page.facets())).containsEntry(TripPriority.BALANCED, 1L)
                .containsEntry(TripPriority.CHEAPEST, 2L)
                .containsEntry(TripPriority.GREENEST, 0L)
                .containsEntry(TripPriority.FASTEST, 1L);
        // the mode chips respect it: only the short hop (train) is left
        assertThat(modeCounts(page.facets())).containsEntry(TransportModeCode.TRAIN, 1L)
                .containsEntry(TransportModeCode.BUS, 0L)
                .containsEntry(TransportModeCode.PLANE, 0L);
    }

    @Test
    void search_greenestPriority_withoutTrips_stillShowsCountsOfTheOtherPriorities() {
        TripPageResponse page = service.search(params().priority(TripPriority.GREENEST).build(), alice.getId());

        assertThat(page.items()).isEmpty();
        assertThat(priorityCounts(page.facets())).containsEntry(TripPriority.CHEAPEST, 2L)
                .containsEntry(TripPriority.BALANCED, 1L)
                .containsEntry(TripPriority.FASTEST, 1L);
    }

    @Test
    void search_severalPriorities_matchesAny() {
        TripPageResponse page = service.search(
                params().priority(TripPriority.BALANCED, TripPriority.FASTEST).build(), alice.getId());

        assertThat(titles(page)).containsExactly(LONG_HAUL, SHORT_HOP);
    }

    @Test
    void search_singleMode_filtersItemsButNotModeFacets() {
        TripPageResponse page = service.search(params().mode(TransportModeCode.BUS).build(), alice.getId());

        assertThat(titles(page)).containsExactly(VIENNA_RETURN, CAPITALS);
        // mode chips ignore the mode filter: counts over all four trips
        assertThat(modeCounts(page.facets())).containsEntry(TransportModeCode.BUS, 2L)
                .containsEntry(TransportModeCode.PLANE, 1L)
                .containsEntry(TransportModeCode.TRAIN, 1L)
                .containsEntry(TransportModeCode.CAR, 0L)
                .containsEntry(TransportModeCode.BIKE, 0L);
        // priority chips respect it: only the two bus trips, both CHEAPEST
        assertThat(priorityCounts(page.facets())).containsEntry(TripPriority.CHEAPEST, 2L)
                .containsEntry(TripPriority.BALANCED, 0L)
                .containsEntry(TripPriority.GREENEST, 0L)
                .containsEntry(TripPriority.FASTEST, 0L);
    }

    @Test
    void search_severalModes_matchesAny() {
        TripPageResponse page = service.search(
                params().mode(TransportModeCode.PLANE, TransportModeCode.TRAIN).build(), alice.getId());

        assertThat(titles(page)).containsExactly(LONG_HAUL, SHORT_HOP);
    }

    @Test
    void search_modeNoTripUses_returnsEmptyPage() {
        TripPageResponse page = service.search(params().mode(TransportModeCode.BIKE).build(), alice.getId());

        assertThat(page.items()).isEmpty();
        assertThat(page.totalPages()).isZero();
    }

    @Test
    void search_priorityAndMode_filterEachOtherInTheFacets() {
        TripPageResponse page = service.search(
                params().priority(TripPriority.CHEAPEST).mode(TransportModeCode.PLANE).build(), alice.getId());

        assertThat(page.items()).isEmpty();
        // priority chips: trips using a plane, whatever their priority -> Long haul (BALANCED)
        assertThat(priorityCounts(page.facets())).containsEntry(TripPriority.BALANCED, 1L)
                .containsEntry(TripPriority.CHEAPEST, 0L);
        // mode chips: CHEAPEST trips, whatever their mode -> two bus trips
        assertThat(modeCounts(page.facets())).containsEntry(TransportModeCode.BUS, 2L)
                .containsEntry(TransportModeCode.PLANE, 0L);
    }

    @Test
    void search_fromAndTo_areInclusive() {
        TripPageResponse page = service.search(params().from(DEC_5).to(DEC_10).build(), alice.getId());

        assertThat(titles(page)).containsExactly(VIENNA_RETURN, CAPITALS);
    }

    @Test
    void search_fromOnly_keepsLaterTrips() {
        assertThat(titles(service.search(params().from(DEC_10).build(), alice.getId())))
                .containsExactly(CAPITALS, SHORT_HOP);
    }

    @Test
    void search_toOnly_keepsEarlierTrips() {
        assertThat(titles(service.search(params().to(DEC_5).build(), alice.getId())))
                .containsExactly(LONG_HAUL, VIENNA_RETURN);
    }

    @Test
    void search_fromEqualsTo_returnsThatDay() {
        assertThat(titles(service.search(params().from(DEC_10).to(DEC_10).build(), alice.getId())))
                .containsExactly(CAPITALS);
    }

    @Test
    void search_fromAfterTo_throwsFieldValidationOnTo() {
        TripSearchParams invalid = params().from(DEC_10).to(DEC_5).build();

        assertThatThrownBy(() -> service.search(invalid, alice.getId()))
                .isInstanceOfSatisfying(FieldValidationException.class, e -> {
                    assertThat(e.getErrors()).hasSize(1);
                    assertThat(e.getErrors().getFirst().field()).isEqualTo("to");
                });
    }

    @Test
    void search_combinedFilters_mustAllMatch() {
        TripPageResponse page = service.search(params().q("rom").priority(TripPriority.CHEAPEST)
                .mode(TransportModeCode.BUS).from(DEC_5).to(DEC_10).build(), alice.getId());

        assertThat(titles(page)).containsExactly(CAPITALS);
        assertThat(page.totalItems()).isEqualTo(1);
    }

    @Test
    void search_textAndDates_narrowTheFacets() {
        TripPageResponse page = service.search(params().q("berlin").from(DEC_5).build(), alice.getId());

        // Vienna return (CHEAPEST, bus) and Short hop (FASTEST, train)
        assertThat(titles(page)).containsExactly(VIENNA_RETURN, SHORT_HOP);
        assertThat(priorityCounts(page.facets())).containsEntry(TripPriority.CHEAPEST, 1L)
                .containsEntry(TripPriority.FASTEST, 1L)
                .containsEntry(TripPriority.BALANCED, 0L);
        assertThat(modeCounts(page.facets())).containsEntry(TransportModeCode.BUS, 1L)
                .containsEntry(TransportModeCode.TRAIN, 1L)
                .containsEntry(TransportModeCode.PLANE, 0L);
    }

    @Test
    void search_facets_listEveryPriorityAndMode() {
        TripFacetsResponse facets = service.search(params().build(), alice.getId()).facets();

        assertThat(facets.priorities()).extracting(TripFacetsResponse.PriorityCount::priority)
                .containsExactlyInAnyOrder(TripPriority.values());
        assertThat(facets.modes()).extracting(TripFacetsResponse.ModeCount::mode)
                .containsExactlyInAnyOrder(TransportModeCode.values());
    }

    @Test
    void search_unfiltered_modeFacetsCountTripsUsingTheMode() {
        Map<TransportModeCode, Long> modes = modeCounts(service.search(params().build(), alice.getId()).facets());

        assertThat(modes).containsEntry(TransportModeCode.PLANE, 1L)
                .containsEntry(TransportModeCode.BUS, 2L)
                .containsEntry(TransportModeCode.TRAIN, 1L)
                .containsEntry(TransportModeCode.CAR, 0L)
                .containsEntry(TransportModeCode.BIKE, 0L);
    }

    @Test
    void search_multiLegTripUsingOneModeTwice_isCountedOncePerMode() {
        TripPageResponse page = service.search(params().q("vienna").build(), alice.getId());

        assertThat(page.items().getFirst().figures().legModes())
                .containsExactly(TransportModeCode.BUS, TransportModeCode.BUS);
        assertThat(page.items().getFirst().figures().modes()).containsExactly(TransportModeCode.BUS);
        assertThat(modeCounts(page.facets())).containsEntry(TransportModeCode.BUS, 1L);
    }

    @Test
    void search_priorityTotals_coverAllMatchingTripsNotOnlyThePage() {
        TripPageResponse all = service.search(params().mode(TransportModeCode.BUS).build(), alice.getId());
        BigDecimal busCostSum = all.items().stream().map(item -> item.figures().totalCost())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        TripPageResponse firstOfTwoPages = service.search(
                params().mode(TransportModeCode.BUS).size(1).build(), alice.getId());

        assertThat(firstOfTwoPages.items()).hasSize(1);
        PriorityTotalResponse cheapest = priorityTotals(firstOfTwoPages).get(TripPriority.CHEAPEST);
        assertThat(cheapest.count()).isEqualTo(2);
        assertThat(cheapest.totalCost()).isEqualByComparingTo(busCostSum);
        assertThat(priorityTotals(firstOfTwoPages).get(TripPriority.BALANCED).count()).isZero();
        assertThat(priorityTotals(firstOfTwoPages).get(TripPriority.BALANCED).totalCost())
                .isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void search_priorityTotals_followTheFiltersExceptPaging() {
        TripPageResponse page = service.search(params().priority(TripPriority.BALANCED).build(), alice.getId());

        Map<TripPriority, PriorityTotalResponse> totals = priorityTotals(page);
        assertThat(totals.get(TripPriority.BALANCED).count()).isEqualTo(1);
        assertThat(totals.get(TripPriority.BALANCED).totalCost())
                .isEqualByComparingTo(page.items().getFirst().figures().totalCost());
        assertThat(totals.get(TripPriority.CHEAPEST).count()).isZero();
        assertThat(totals).hasSize(TripPriority.values().length);
    }

    @Test
    void search_sortByDateAscending_isTheDefaultOrder() {
        assertThat(titles(sorted("date", "asc"))).containsExactly(LONG_HAUL, VIENNA_RETURN, CAPITALS, SHORT_HOP);
    }

    @Test
    void search_sortByDateDescending_reversesTheOrder() {
        assertThat(titles(sorted("date", "desc"))).containsExactly(SHORT_HOP, CAPITALS, VIENNA_RETURN, LONG_HAUL);
    }

    @Test
    void search_sortByCostAscending_putsTheShortTripFirst() {
        assertThat(titles(sorted("cost", "asc"))).containsExactly(SHORT_HOP, VIENNA_RETURN, CAPITALS, LONG_HAUL);
    }

    @Test
    void search_sortByCostDescending_putsTheIntercontinentalTripFirst() {
        assertThat(titles(sorted("cost", "desc"))).containsExactly(LONG_HAUL, CAPITALS, VIENNA_RETURN, SHORT_HOP);
    }

    @Test
    void search_sortByCo2Ascending_putsTheShortTrainTripFirst() {
        assertThat(titles(sorted("co2", "asc"))).containsExactly(SHORT_HOP, VIENNA_RETURN, CAPITALS, LONG_HAUL);
    }

    @Test
    void search_sortByCo2Descending_putsTheFlightFirst() {
        assertThat(titles(sorted("co2", "desc"))).containsExactly(LONG_HAUL, CAPITALS, VIENNA_RETURN, SHORT_HOP);
    }

    @Test
    void search_sortWithoutDirection_isAscending() {
        TripPageResponse page = service.search(params().sort("cost").build(), alice.getId());

        assertThat(titles(page)).containsExactly(SHORT_HOP, VIENNA_RETURN, CAPITALS, LONG_HAUL);
    }

    @Test
    void search_equalFigures_tieBreakByDateThenId() {
        save(alice, "Twin of short hop A", DEC_20, TripPriority.FASTEST, "Berlin", "Prague");
        save(alice, "Twin of short hop B", DEC_20, TripPriority.FASTEST, "Berlin", "Prague");
        save(alice, "Earlier twin", DEC_10, TripPriority.FASTEST, "Berlin", "Prague");
        entityManager.flush();
        entityManager.clear();

        TripPageResponse page = service.search(params().sort("cost").priority(TripPriority.FASTEST).build(),
                alice.getId());

        assertThat(titles(page)).containsExactly("Earlier twin", SHORT_HOP, "Twin of short hop A",
                "Twin of short hop B");
        TripPageResponse descending = service.search(
                params().sort("cost").direction("desc").priority(TripPriority.FASTEST).build(), alice.getId());
        assertThat(titles(descending)).containsExactly("Earlier twin", SHORT_HOP, "Twin of short hop A",
                "Twin of short hop B");
    }

    @Test
    void search_pagingWithSizeOne_returnsOneTripPerPage() {
        TripPageResponse second = service.search(params().page(1).size(1).build(), alice.getId());

        assertThat(titles(second)).containsExactly(VIENNA_RETURN);
        assertThat(second.page()).isEqualTo(1);
        assertThat(second.size()).isEqualTo(1);
        assertThat(second.totalItems()).isEqualTo(4);
        assertThat(second.totalPages()).isEqualTo(4);
    }

    @Test
    void search_lastPartialPage_holdsTheRemainder() {
        TripPageResponse first = service.search(params().page(0).size(3).build(), alice.getId());
        TripPageResponse last = service.search(params().page(1).size(3).build(), alice.getId());

        assertThat(titles(first)).containsExactly(LONG_HAUL, VIENNA_RETURN, CAPITALS);
        assertThat(titles(last)).containsExactly(SHORT_HOP);
        assertThat(last.totalPages()).isEqualTo(2);
        assertThat(last.totalItems()).isEqualTo(4);
    }

    @Test
    void search_exactlyFullPage_hasOnePage() {
        TripPageResponse page = service.search(params().size(4).build(), alice.getId());

        assertThat(page.items()).hasSize(4);
        assertThat(page.totalPages()).isEqualTo(1);
    }

    @Test
    void search_pagePastTheEnd_isEmptyButKeepsTotalsAndFacets() {
        TripPageResponse page = service.search(params().page(5).size(2).build(), alice.getId());

        assertThat(page.items()).isEmpty();
        assertThat(page.page()).isEqualTo(5);
        assertThat(page.totalItems()).isEqualTo(4);
        assertThat(page.totalPages()).isEqualTo(2);
        assertThat(priorityCounts(page.facets())).containsEntry(TripPriority.CHEAPEST, 2L);
        assertThat(priorityTotals(page).get(TripPriority.CHEAPEST).count()).isEqualTo(2);
    }

    @Test
    void search_pagingFollowsTheSortOrder() {
        TripPageResponse page = service.search(
                params().sort("cost").direction("desc").page(1).size(2).build(), alice.getId());

        assertThat(titles(page)).containsExactly(VIENNA_RETURN, SHORT_HOP);
    }

    @Test
    void activeTrips_returnsOnlyTheOwnersNotDeletedTripsSoonestFirst() {
        List<FiguredTrip> trips = service.activeTrips(alice.getId());

        assertThat(trips).extracting(item -> item.trip().getTitle())
                .containsExactly(LONG_HAUL, VIENNA_RETURN, CAPITALS, SHORT_HOP);
        assertThat(trips).allSatisfy(item -> assertThat(item.figures()).isPresent());
    }

    @Test
    void activeTrips_afterTheTripIsDeleted_nolongerContainsIt() {
        Trip capitals = tripRepository.findAll().stream()
                .filter(trip -> CAPITALS.equals(trip.getTitle())).findFirst().orElseThrow();
        capitals.markDeleted(Instant.parse("2026-11-13T12:00:00Z"));
        tripRepository.saveAndFlush(capitals);
        entityManager.clear();

        assertThat(service.activeTrips(alice.getId())).extracting(item -> item.trip().getTitle())
                .containsExactly(LONG_HAUL, VIENNA_RETURN, SHORT_HOP);
        assertThat(titles(service.search(params().build(), alice.getId())))
                .containsExactly(LONG_HAUL, VIENNA_RETURN, SHORT_HOP);
    }

    @Test
    void activeTrips_unknownOwner_isEmpty() {
        assertThat(service.activeTrips(999_999L)).isEmpty();
    }

    private TripPageResponse sorted(String sort, String direction) {
        return service.search(params().sort(sort).direction(direction).build(), alice.getId());
    }

    private static List<String> titles(TripPageResponse page) {
        return page.items().stream().map(TripListItemResponse::title).toList();
    }

    private static Map<TripPriority, Long> priorityCounts(TripFacetsResponse facets) {
        return facets.priorities().stream().collect(Collectors.toMap(
                TripFacetsResponse.PriorityCount::priority, TripFacetsResponse.PriorityCount::count));
    }

    private static Map<TransportModeCode, Long> modeCounts(TripFacetsResponse facets) {
        return facets.modes().stream().collect(Collectors.toMap(
                TripFacetsResponse.ModeCount::mode, TripFacetsResponse.ModeCount::count));
    }

    private static Map<TripPriority, PriorityTotalResponse> priorityTotals(TripPageResponse page) {
        return page.priorityTotals().stream()
                .collect(Collectors.toMap(PriorityTotalResponse::priority, Function.identity()));
    }

    private static ParamsBuilder params() {
        return new ParamsBuilder();
    }

    private Trip save(AppUser owner, String title, LocalDate departure, TripPriority priority, String... stops) {
        return tripRepository.save(trip(owner, title, departure, priority, stops));
    }

    private Trip trip(AppUser owner, String title, LocalDate departure, TripPriority priority, String... stopNames) {
        Trip trip = new Trip();
        trip.setTitle(title);
        trip.replaceStops(Arrays.stream(stopNames).map(this::cityByName).toList());
        trip.setDepartureDate(departure);
        trip.setTravelers(2);
        trip.setPriority(priority);
        trip.setOwnerId(owner.getId());
        return trip;
    }

    private City cityByName(String name) {
        return cityRepository.findByNameContainingIgnoreCaseOrderByNameAsc(name).getFirst();
    }

    private static AppUser user(String email) {
        AppUser user = new AppUser();
        user.setEmail(email);
        user.setDisplayName(email.substring(0, email.indexOf('@')));
        user.setPasswordHash("$2a$10$hashedPasswordForTestsOnly");
        return user;
    }

    /** Builds {@link TripSearchParams}; every value not set stays {@code null} like an absent query parameter. */
    private static final class ParamsBuilder {

        private String q;
        private List<TripPriority> priority;
        private List<TransportModeCode> mode;
        private LocalDate from;
        private LocalDate to;
        private String sort;
        private String direction;
        private Integer page;
        private Integer size;

        ParamsBuilder q(String value) {
            q = value;
            return this;
        }

        ParamsBuilder priority(TripPriority... values) {
            priority = List.of(values);
            return this;
        }

        ParamsBuilder mode(TransportModeCode... values) {
            mode = List.of(values);
            return this;
        }

        ParamsBuilder from(LocalDate value) {
            from = value;
            return this;
        }

        ParamsBuilder to(LocalDate value) {
            to = value;
            return this;
        }

        ParamsBuilder sort(String value) {
            sort = value;
            return this;
        }

        ParamsBuilder direction(String value) {
            direction = value;
            return this;
        }

        ParamsBuilder page(int value) {
            page = value;
            return this;
        }

        ParamsBuilder size(int value) {
            size = value;
            return this;
        }

        TripSearchParams build() {
            return new TripSearchParams(q, priority, mode, from, to, sort, direction, page, size);
        }
    }
}
