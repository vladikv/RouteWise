package com.routewise.demo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;

import com.routewise.city.dto.CityResponse;
import com.routewise.city.service.CityService;
import com.routewise.demo.config.DemoProperties;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.dto.TripRequest;
import com.routewise.trip.dto.TripStopRequest;
import com.routewise.trip.service.TripService;
import com.routewise.user.domain.AuthUser;
import com.routewise.user.dto.RegisterRequest;
import com.routewise.user.service.UserService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DemoDataSeederTest {

    private static final DemoProperties PROPERTIES =
            new DemoProperties(true, "demo@routewise.app", "demo1234", "Demo traveller");
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-12T10:00:00Z"), ZoneOffset.UTC);

    @Mock
    private UserService userService;

    @Mock
    private CityService cityService;

    @Mock
    private TripService tripService;

    private DemoDataSeeder seeder;

    @BeforeEach
    void setUp() {
        seeder = new DemoDataSeeder(PROPERTIES, userService, cityService, tripService, CLOCK);
    }

    @Test
    void run_createsDemoAccountWithUpcomingSampleTrips() {
        when(userService.isRegistered("demo@routewise.app")).thenReturn(false);
        when(userService.register(new RegisterRequest("demo@routewise.app", "demo1234", "Demo traveller")))
                .thenReturn(new AuthUser(42L, "demo@routewise.app", "Demo traveller", null));
        when(cityService.findAll(null)).thenReturn(List.of(
                city(1L, "Berlin"), city(2L, "Vienna"), city(3L, "Paris"),
                city(4L, "Amsterdam"), city(5L, "Munich"), city(6L, "Prague")));

        seeder.run(null);

        ArgumentCaptor<TripRequest> trips = ArgumentCaptor.forClass(TripRequest.class);
        verify(tripService, times(4)).create(trips.capture(), eq(42L));
        // Today is 2026-11-12: +14, +21, +30 and +45 days.
        assertThat(trips.getAllValues()).containsExactly(
                new TripRequest("Weekend in Vienna", stops(1L, 2L), LocalDate.of(2026, 11, 26), 2,
                        TripPriority.GREENEST, "City break with a friend"),
                new TripRequest("Central Europe rail loop", stops(1L, 6L, 2L, 5L, 1L), LocalDate.of(2026, 12, 3), 2,
                        TripPriority.BALANCED, "Two nights in each city"),
                new TripRequest("Client meeting in Amsterdam", stops(3L, 4L), LocalDate.of(2026, 12, 12), 1,
                        TripPriority.FASTEST, null),
                new TripRequest("Family trip to Prague", stops(5L, 6L), LocalDate.of(2026, 12, 27), 4,
                        TripPriority.CHEAPEST, "Two adults, two kids"));
        assertThat(trips.getAllValues()).anySatisfy(trip -> assertThat(trip.stops()).hasSizeGreaterThanOrEqualTo(3));
    }

    @Test
    void run_whenDemoAccountExists_changesNothing() {
        when(userService.isRegistered("demo@routewise.app")).thenReturn(true);

        seeder.run(null);

        verify(userService, never()).register(any());
        verifyNoInteractions(cityService, tripService);
    }

    private static CityResponse city(long id, String name) {
        return new CityResponse(id, name, "XX", 0, 0);
    }

    private static List<TripStopRequest> stops(Long... cityIds) {
        return Arrays.stream(cityIds).map(TripStopRequest::new).toList();
    }
}
