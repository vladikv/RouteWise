package com.routewise.trip.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import com.routewise.city.domain.City;
import com.routewise.city.repository.CityRepository;
import com.routewise.common.config.ClockConfig;
import com.routewise.common.config.JpaAuditingConfig;
import com.routewise.transportmode.domain.TransportMode;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.transportmode.repository.TransportModeRepository;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.domain.TripStop;
import com.routewise.user.domain.AppUser;
import com.routewise.user.repository.AppUserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

/**
 * Runs against the real Flyway schema and seed data (ddl-auto=validate).
 */
@DataJpaTest
@Import({JpaAuditingConfig.class, ClockConfig.class})
class TripRepositoryTest {

    @Autowired
    private TripRepository tripRepository;

    @Autowired
    private CityRepository cityRepository;

    @Autowired
    private TransportModeRepository transportModeRepository;

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
    void seedData_containsCitiesAndAllTransportModes() {
        // 25 cities from V2 plus the worldwide seed of V7 (the exact total is asserted in CityMigrationTest)
        assertThat(cityRepository.count()).isGreaterThanOrEqualTo(25);
        assertThat(cityRepository.findByNameContainingIgnoreCaseOrderByNameAsc("VIE"))
                .extracting(City::getName).containsExactly("Vienna");
        assertThat(transportModeRepository.findAll()).extracting(TransportMode::getCode)
                .containsExactlyInAnyOrder(TransportModeCode.values());
    }

    @Test
    void save_setsIdAndTimestamps() {
        Trip saved = tripRepository.saveAndFlush(trip(LocalDate.now().plusDays(3), "Berlin", "Vienna"));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void findAllBySpecification_returnsOnlyThatOwnersTripsInTheGivenOrderWithCitiesLoaded() {
        tripRepository.save(trip(LocalDate.now().plusDays(30), "Paris", "Rome"));
        tripRepository.save(trip(LocalDate.now().plusDays(3), "Berlin", "Vienna"));
        Trip bobsTrip = trip(LocalDate.now().plusDays(1), "Lisbon", "Madrid");
        bobsTrip.setOwnerId(bob.getId());
        tripRepository.save(bobsTrip);
        entityManager.flush();
        entityManager.clear();

        List<Trip> trips = tripRepository.findAll(
                Specification.allOf(TripSpecifications.ownedBy(alice.getId()), TripSpecifications.active()),
                Sort.by("departureDate", "id"));

        assertThat(trips).extracting(trip -> trip.stopCities().getFirst().getName())
                .containsExactly("Berlin", "Paris");
    }

    @Test
    void deletedTrips_areLeftOutOfActiveQueries_butFoundForRestore() {
        Trip kept = tripRepository.save(trip(LocalDate.now().plusDays(3), "Berlin", "Vienna"));
        Trip deleted = trip(LocalDate.now().plusDays(4), "Paris", "Rome");
        deleted.markDeleted(Instant.parse("2026-11-13T10:00:00Z"));
        deleted = tripRepository.save(deleted);
        entityManager.flush();
        entityManager.clear();

        assertThat(tripRepository.findAll(
                        Specification.allOf(TripSpecifications.ownedBy(alice.getId()), TripSpecifications.active()),
                        Sort.unsorted()))
                .extracting(Trip::getId).containsExactly(kept.getId());
        assertThat(tripRepository.findActiveByIdAndOwnerId(deleted.getId(), alice.getId()))
                .isEmpty();
        assertThat(tripRepository.findWithStopsByIdAndOwnerId(deleted.getId(), alice.getId()))
                .get().extracting(Trip::getDeletedAt).isNotNull();
    }

    @Test
    void findWithStopsByIdAndOwnerId_forAnotherOwner_isEmpty() {
        Trip alicesTrip = tripRepository.saveAndFlush(trip(LocalDate.now().plusDays(3), "Berlin", "Vienna"));

        assertThat(tripRepository.findWithStopsByIdAndOwnerId(alicesTrip.getId(), alice.getId())).isPresent();
        assertThat(tripRepository.findWithStopsByIdAndOwnerId(alicesTrip.getId(), bob.getId())).isEmpty();
    }

    @Test
    void save_keepsStopsInOrder_andLoadsThemWithTheirCities() {
        Trip saved = tripRepository.saveAndFlush(
                trip(LocalDate.now().plusDays(3), "Berlin", "Prague", "Vienna", "Berlin"));
        entityManager.clear();

        Trip loaded = tripRepository.findWithStopsByIdAndOwnerId(saved.getId(), alice.getId()).orElseThrow();

        assertThat(loaded.stopCities()).extracting(City::getName)
                .containsExactly("Berlin", "Prague", "Vienna", "Berlin");
        assertThat(loaded.getStops()).extracting(TripStop::getPosition).containsExactly(0, 1, 2, 3);
    }

    @Test
    void replaceStops_growsAndShrinks_withoutBreakingTheUniquePosition() {
        Trip saved = tripRepository.saveAndFlush(trip(LocalDate.now().plusDays(3), "Berlin", "Vienna"));

        saved.replaceStops(List.of(cityByName("Vienna"), cityByName("Prague"), cityByName("Munich")));
        tripRepository.saveAndFlush(saved);
        saved.replaceStops(List.of(cityByName("Rome"), cityByName("Milan")));
        tripRepository.saveAndFlush(saved);
        entityManager.clear();

        Trip loaded = tripRepository.findWithStopsByIdAndOwnerId(saved.getId(), alice.getId()).orElseThrow();
        assertThat(loaded.stopCities()).extracting(City::getName).containsExactly("Rome", "Milan");
        assertThat(stopRows(saved.getId())).isEqualTo(2L);
    }

    @Test
    void delete_removesTheTripsStops() {
        Trip saved = tripRepository.saveAndFlush(trip(LocalDate.now().plusDays(3), "Berlin", "Prague", "Vienna"));

        tripRepository.delete(saved);
        tripRepository.flush();

        assertThat(stopRows(saved.getId())).isZero();
    }

    @Test
    void save_withDuplicateEmail_isRejectedByDatabase() {
        assertThatThrownBy(() -> userRepository.saveAndFlush(user("alice@example.com")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void findById_bySeededModeCode_findsMode() {
        assertThat(transportModeRepository.findById(TransportModeCode.TRAIN)).isPresent();
    }

    @Test
    void save_withTwoStopsAtOnePosition_isRejectedByDatabase() {
        Trip trip = trip(LocalDate.now().plusDays(3), "Berlin", "Vienna");
        trip.getStops().getLast().setPosition(0);

        assertThatThrownBy(() -> tripRepository.saveAndFlush(trip))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private Trip trip(LocalDate departureDate, String... stopNames) {
        Trip trip = new Trip();
        trip.setTitle(String.join(" to ", stopNames));
        trip.replaceStops(Arrays.stream(stopNames).map(this::cityByName).toList());
        trip.setDepartureDate(departureDate);
        trip.setTravelers(2);
        trip.setPriority(TripPriority.BALANCED);
        trip.setOwnerId(alice.getId());
        return trip;
    }

    private static AppUser user(String email) {
        AppUser user = new AppUser();
        user.setEmail(email);
        user.setDisplayName(email.substring(0, email.indexOf('@')));
        user.setPasswordHash("$2a$10$hashedPasswordForTestsOnly");
        return user;
    }

    private long stopRows(Long tripId) {
        return (Long) entityManager.getEntityManager()
                .createNativeQuery("SELECT COUNT(*) FROM trip_stop WHERE trip_id = :id", Long.class)
                .setParameter("id", tripId)
                .getSingleResult();
    }

    private City cityByName(String name) {
        return cityRepository.findByNameContainingIgnoreCaseOrderByNameAsc(name).getFirst();
    }
}
