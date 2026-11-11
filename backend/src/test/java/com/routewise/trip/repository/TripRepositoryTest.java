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
    private TestEntityManager entityManager;

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
    void findAllByOrderByDepartureDate_returnsSoonestFirstWithCitiesLoaded() {
        tripRepository.save(trip("Paris", "Rome", LocalDate.now().plusDays(30)));
        tripRepository.save(trip("Berlin", "Vienna", LocalDate.now().plusDays(3)));
        entityManager.flush();
        entityManager.clear();

        List<Trip> trips = tripRepository.findAllByOrderByDepartureDateAscIdAsc();

        assertThat(trips).extracting(trip -> trip.getOrigin().getName()).containsExactly("Berlin", "Paris");
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
        return trip;
    }

    private City cityByName(String name) {
        return cityRepository.findByNameContainingIgnoreCaseOrderByNameAsc(name).getFirst();
    }
}
