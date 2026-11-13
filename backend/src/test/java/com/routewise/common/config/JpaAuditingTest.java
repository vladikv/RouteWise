package com.routewise.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import com.routewise.city.repository.CityRepository;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.repository.TripRepository;
import com.routewise.user.domain.AppUser;
import com.routewise.user.repository.AppUserRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

/** Audit timestamps come from the injected clock, not from the database or the system time. */
@DataJpaTest
@Import({JpaAuditingConfig.class, JpaAuditingTest.ClockSetup.class})
class JpaAuditingTest {

    private static final Instant CREATED = Instant.parse("2026-11-13T09:00:00Z");
    private static final Instant MODIFIED = Instant.parse("2026-11-13T10:30:00Z");

    @Autowired
    private MutableClock clock;

    @Autowired
    private TripRepository tripRepository;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private CityRepository cityRepository;

    @Test
    void save_setsCreatedAndModifiedFromTheClock_andUpdateOnlyMovesModified() {
        clock.set(CREATED);
        AppUser user = userRepository.saveAndFlush(user());
        Trip trip = tripRepository.saveAndFlush(trip(user.getId()));

        assertThat(user.getCreatedAt()).isEqualTo(CREATED);
        assertThat(trip.getCreatedAt()).isEqualTo(CREATED);
        assertThat(trip.getUpdatedAt()).isEqualTo(CREATED);

        clock.set(MODIFIED);
        trip.setTitle("Renamed");
        Trip updated = tripRepository.saveAndFlush(trip);

        assertThat(updated.getCreatedAt()).isEqualTo(CREATED);
        assertThat(updated.getUpdatedAt()).isEqualTo(MODIFIED);
    }

    private Trip trip(Long ownerId) {
        Trip trip = new Trip();
        trip.setOwnerId(ownerId);
        trip.setTitle("Weekend");
        trip.setDepartureDate(LocalDate.of(2026, 12, 1));
        trip.setTravelers(1);
        trip.setPriority(TripPriority.BALANCED);
        trip.replaceStops(List.of(
                cityRepository.findByNameContainingIgnoreCaseOrderByNameAsc("Berlin").getFirst(),
                cityRepository.findByNameContainingIgnoreCaseOrderByNameAsc("Vienna").getFirst()));
        return trip;
    }

    private static AppUser user() {
        AppUser user = new AppUser();
        user.setEmail("audit@example.com");
        user.setPasswordHash("x");
        user.setDisplayName("Audit");
        return user;
    }

    @TestConfiguration
    static class ClockSetup {

        @Bean
        MutableClock clock() {
            return new MutableClock();
        }
    }

    /** A clock the test moves forward. */
    static class MutableClock extends Clock {

        private Instant now = Instant.EPOCH;

        void set(Instant instant) {
            now = instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
