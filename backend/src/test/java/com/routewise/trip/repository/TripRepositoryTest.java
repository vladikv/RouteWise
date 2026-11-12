package com.routewise.trip.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;

import com.routewise.city.domain.City;
import com.routewise.city.repository.CityRepository;
import com.routewise.transportmode.domain.TransportMode;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.transportmode.repository.TransportModeRepository;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.user.domain.AppUser;
import com.routewise.user.repository.AppUserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Runs against the real Flyway schema and seed data (ddl-auto=validate).
 */
@DataJpaTest
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
        assertThat(cityRepository.count()).isEqualTo(25);
        assertThat(cityRepository.findByNameContainingIgnoreCaseOrderByNameAsc("VIE"))
                .extracting(City::getName).containsExactly("Vienna");
        assertThat(transportModeRepository.findAll()).extracting(TransportMode::getCode)
                .containsExactlyInAnyOrder(TransportModeCode.values());
    }

    @Test
    void save_setsIdAndTimestamps() {
        Trip saved = tripRepository.saveAndFlush(trip("Berlin", "Vienna", LocalDate.now().plusDays(3)));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void findAllByOwnerId_returnsOnlyThatOwnersTripsSoonestFirstWithCitiesLoaded() {
        tripRepository.save(trip("Paris", "Rome", LocalDate.now().plusDays(30)));
        tripRepository.save(trip("Berlin", "Vienna", LocalDate.now().plusDays(3)));
        Trip bobsTrip = trip("Lisbon", "Madrid", LocalDate.now().plusDays(1));
        bobsTrip.setOwnerId(bob.getId());
        tripRepository.save(bobsTrip);
        entityManager.flush();
        entityManager.clear();

        List<Trip> trips = tripRepository.findAllByOwnerIdOrderByDepartureDateAscIdAsc(alice.getId());

        assertThat(trips).extracting(trip -> trip.getOrigin().getName()).containsExactly("Berlin", "Paris");
    }

    @Test
    void findWithCitiesByIdAndOwnerId_forAnotherOwner_isEmpty() {
        Trip alicesTrip = tripRepository.saveAndFlush(trip("Berlin", "Vienna", LocalDate.now().plusDays(3)));

        assertThat(tripRepository.findWithCitiesByIdAndOwnerId(alicesTrip.getId(), alice.getId())).isPresent();
        assertThat(tripRepository.findWithCitiesByIdAndOwnerId(alicesTrip.getId(), bob.getId())).isEmpty();
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
    void save_withSameOriginAndDestination_isRejectedByDatabase() {
        Trip trip = trip("Berlin", "Berlin", LocalDate.now().plusDays(3));

        assertThatThrownBy(() -> tripRepository.saveAndFlush(trip))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private Trip trip(String originName, String destinationName, LocalDate departureDate) {
        Trip trip = new Trip();
        trip.setTitle(originName + " to " + destinationName);
        trip.setOrigin(cityByName(originName));
        trip.setDestination(cityByName(destinationName));
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

    private City cityByName(String name) {
        return cityRepository.findByNameContainingIgnoreCaseOrderByNameAsc(name).getFirst();
    }
}
