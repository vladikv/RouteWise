package com.routewise.trip.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import com.routewise.city.domain.City;
import com.routewise.city.repository.CityRepository;
import com.routewise.common.config.ClockConfig;
import com.routewise.common.config.JpaAuditingConfig;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.user.domain.AppUser;
import com.routewise.user.repository.AppUserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

/**
 * Runs the specifications against the real Flyway schema and seed data.
 */
@DataJpaTest
@Import({JpaAuditingConfig.class, ClockConfig.class})
class TripSpecificationsTest {

    private static final LocalDate DEC_1 = LocalDate.of(2026, 12, 1);
    private static final LocalDate DEC_5 = LocalDate.of(2026, 12, 5);
    private static final LocalDate DEC_10 = LocalDate.of(2026, 12, 10);

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
    void createUsers() {
        alice = userRepository.save(user("alice@example.com"));
        bob = userRepository.save(user("bob@example.com"));
    }

    @Test
    void matches_titleText_findsTripByTitleIgnoringCase() {
        save(alice, "Summer Holiday", DEC_1, "Berlin", "Prague");
        save(alice, "Business", DEC_5, "Paris", "Rome");

        assertThat(titles(TripSpecifications.matches("hOLiDay"))).containsExactly("Summer Holiday");
    }

    @Test
    void matches_cityName_findsTripByStopCityIgnoringCase() {
        save(alice, "Trip one", DEC_1, "Berlin", "Vienna");
        save(alice, "Trip two", DEC_5, "Paris", "Rome");

        assertThat(titles(TripSpecifications.matches("VIENNA"))).containsExactly("Trip one");
        assertThat(titles(TripSpecifications.matches("rom"))).containsExactly("Trip two");
    }

    @Test
    void matches_cityNameOfAnyStop_findsTripWithMatchInTheMiddle() {
        save(alice, "Grand tour", DEC_1, "Berlin", "Prague", "Vienna");

        assertThat(titles(TripSpecifications.matches("prague"))).containsExactly("Grand tour");
    }

    @Test
    void matches_tripVisitingTwoMatchingCities_isReturnedOnce() {
        // "n" is in Berlin and Vienna but not in the title "Trip X"
        save(alice, "Trip X", DEC_1, "Berlin", "Vienna");
        save(alice, "Trip Y", DEC_5, "Paris", "Rome");

        assertThat(titles(TripSpecifications.matches("n"))).containsExactly("Trip X");
    }

    @Test
    void matches_textInTitleAndCity_isReturnedOnce() {
        save(alice, "Berlin and back", DEC_1, "Berlin", "Prague", "Berlin");

        assertThat(titles(TripSpecifications.matches("berlin"))).containsExactly("Berlin and back");
    }

    @Test
    void matches_percentSign_isTreatedLiterally() {
        save(alice, "Save 50% now", DEC_1, "Paris", "Rome");
        save(alice, "Save 500 now", DEC_5, "Paris", "Rome");

        assertThat(titles(TripSpecifications.matches("50%"))).containsExactly("Save 50% now");
        assertThat(titles(TripSpecifications.matches("%"))).containsExactly("Save 50% now");
    }

    @Test
    void matches_underscore_isTreatedLiterally() {
        save(alice, "a_b", DEC_1, "Paris", "Rome");
        save(alice, "axb", DEC_5, "Paris", "Rome");

        assertThat(titles(TripSpecifications.matches("a_b"))).containsExactly("a_b");
    }

    @Test
    void matches_backslash_isTreatedLiterally() {
        save(alice, "a\\b", DEC_1, "Paris", "Rome");
        save(alice, "ab", DEC_5, "Paris", "Rome");

        assertThat(titles(TripSpecifications.matches("a\\b"))).containsExactly("a\\b");
    }

    @Test
    void matches_noMatch_returnsNothing() {
        save(alice, "Summer Holiday", DEC_1, "Berlin", "Prague");

        assertThat(titles(TripSpecifications.matches("tokyo"))).isEmpty();
    }

    @Test
    void matches_surroundingWhitespace_isStripped() {
        save(alice, "Summer Holiday", DEC_1, "Berlin", "Prague");

        assertThat(titles(TripSpecifications.matches("  holiday  "))).containsExactly("Summer Holiday");
    }

    @Test
    void matches_nullBlankOrEmptyText_doesNotRestrict() {
        save(alice, "One", DEC_1, "Berlin", "Prague");
        save(alice, "Two", DEC_5, "Paris", "Rome");

        assertThat(titles(TripSpecifications.matches(null))).containsExactly("One", "Two");
        assertThat(titles(TripSpecifications.matches(""))).containsExactly("One", "Two");
        assertThat(titles(TripSpecifications.matches("   "))).containsExactly("One", "Two");
    }

    @Test
    void ownedBy_otherUsersTrips_areExcluded() {
        save(alice, "Alice trip", DEC_1, "Berlin", "Prague");
        save(bob, "Bob trip", DEC_1, "Berlin", "Prague");

        assertThat(titles(TripSpecifications.matches("trip"))).containsExactly("Alice trip");
    }

    @Test
    void matches_cityOfAnotherOwnersTrip_doesNotLeakIntoOwnResults() {
        save(alice, "Alice trip", DEC_1, "Paris", "Rome");
        save(bob, "Bob trip", DEC_1, "Berlin", "Vienna");

        assertThat(titles(TripSpecifications.matches("vienna"))).isEmpty();
    }

    @Test
    void active_deletedTrips_areExcluded() {
        save(alice, "Kept", DEC_1, "Berlin", "Prague");
        Trip deleted = trip(alice, "Deleted", DEC_5, "Berlin", "Prague");
        deleted.markDeleted(Instant.parse("2026-11-13T10:00:00Z"));
        tripRepository.save(deleted);

        assertThat(titles(TripSpecifications.matches("berlin"))).containsExactly("Kept");
    }

    @Test
    void departingFrom_tripOnTheBound_isIncluded() {
        save(alice, "Dec 1", DEC_1, "Berlin", "Prague");
        save(alice, "Dec 5", DEC_5, "Berlin", "Prague");
        save(alice, "Dec 10", DEC_10, "Berlin", "Prague");

        assertThat(titles(TripSpecifications.departingFrom(DEC_5))).containsExactly("Dec 5", "Dec 10");
    }

    @Test
    void departingUntil_tripOnTheBound_isIncluded() {
        save(alice, "Dec 1", DEC_1, "Berlin", "Prague");
        save(alice, "Dec 5", DEC_5, "Berlin", "Prague");
        save(alice, "Dec 10", DEC_10, "Berlin", "Prague");

        assertThat(titles(TripSpecifications.departingUntil(DEC_5))).containsExactly("Dec 1", "Dec 5");
    }

    @Test
    void departing_nullBounds_doNotRestrict() {
        save(alice, "Dec 1", DEC_1, "Berlin", "Prague");
        save(alice, "Dec 10", DEC_10, "Berlin", "Prague");

        assertThat(titles(Specification.allOf(
                TripSpecifications.departingFrom(null), TripSpecifications.departingUntil(null))))
                .containsExactly("Dec 1", "Dec 10");
    }

    @Test
    void departing_sameDayOnBothBounds_returnsThatDay() {
        save(alice, "Dec 1", DEC_1, "Berlin", "Prague");
        save(alice, "Dec 5", DEC_5, "Berlin", "Prague");
        save(alice, "Dec 10", DEC_10, "Berlin", "Prague");

        assertThat(titles(Specification.allOf(
                TripSpecifications.departingFrom(DEC_5), TripSpecifications.departingUntil(DEC_5))))
                .containsExactly("Dec 5");
    }

    @Test
    void textAndDates_combined_mustAllMatch() {
        save(alice, "Berlin early", DEC_1, "Berlin", "Prague");
        save(alice, "Berlin middle", DEC_5, "Berlin", "Prague");
        save(alice, "Rome middle", DEC_5, "Paris", "Rome");
        save(alice, "Berlin late", DEC_10, "Berlin", "Prague");

        assertThat(titles(Specification.allOf(TripSpecifications.matches("berlin"),
                TripSpecifications.departingFrom(DEC_5), TripSpecifications.departingUntil(DEC_5))))
                .containsExactly("Berlin middle");
        assertThat(titles(Specification.allOf(TripSpecifications.matches("rome"),
                TripSpecifications.departingFrom(DEC_10))))
                .isEmpty();
    }

    /** Titles of alice's active trips that satisfy {@code spec}, soonest first. */
    private List<String> titles(Specification<Trip> spec) {
        entityManager.flush();
        entityManager.clear();
        return tripRepository.findAll(
                        Specification.allOf(TripSpecifications.ownedBy(alice.getId()), TripSpecifications.active(), spec),
                        Sort.by("departureDate", "id"))
                .stream().map(Trip::getTitle).toList();
    }

    private Trip save(AppUser owner, String title, LocalDate departure, String... stopNames) {
        return tripRepository.save(trip(owner, title, departure, stopNames));
    }

    private Trip trip(AppUser owner, String title, LocalDate departure, String... stopNames) {
        Trip trip = new Trip();
        trip.setTitle(title);
        trip.replaceStops(Arrays.stream(stopNames).map(this::cityByName).toList());
        trip.setDepartureDate(departure);
        trip.setTravelers(2);
        trip.setPriority(TripPriority.BALANCED);
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
}
