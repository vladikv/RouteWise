package com.routewise.demo.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Creates the demo account with a few upcoming sample trips at start-up, through
 * the regular services so the same rules apply. Skipped when the account
 * already exists or {@code routewise.demo.enabled=false}.
 */
@Component
@EnableConfigurationProperties(DemoProperties.class)
@ConditionalOnProperty(name = "routewise.demo.enabled", havingValue = "true", matchIfMissing = true)
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    /** Departures are relative to today, so the samples never lie in the past. */
    record SampleTrip(String title, List<String> stops, int daysAhead, int travelers, TripPriority priority,
                      String notes) {
    }

    static final List<SampleTrip> SAMPLE_TRIPS = List.of(
            new SampleTrip("Weekend in Vienna", List.of("Berlin", "Vienna"), 14, 2, TripPriority.GREENEST,
                    "City break with a friend"),
            new SampleTrip("Central Europe loop", List.of("Berlin", "Prague", "Vienna", "Munich", "Berlin"),
                    21, 2, TripPriority.FASTEST, "Short on time: two nights in each city"),
            new SampleTrip("Client meeting in Amsterdam", List.of("Paris", "Amsterdam"), 30, 1,
                    TripPriority.FASTEST, null),
            new SampleTrip("Family trip to Prague", List.of("Munich", "Prague"), 45, 4, TripPriority.CHEAPEST,
                    "Two adults, two kids"));

    private final DemoProperties properties;
    private final UserService userService;
    private final CityService cityService;
    private final TripService tripService;
    private final Clock clock;

    public DemoDataSeeder(DemoProperties properties, UserService userService, CityService cityService,
                          TripService tripService, Clock clock) {
        this.properties = properties;
        this.userService = userService;
        this.cityService = cityService;
        this.tripService = tripService;
        this.clock = clock;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userService.isRegistered(properties.email())) {
            log.info("Demo account {} already exists", properties.email());
            return;
        }
        AuthUser demo = userService.register(
                new RegisterRequest(properties.email(), properties.password(), properties.displayName()));
        Map<String, Long> cityIds = cityService.findAll(null).stream()
                .collect(Collectors.toMap(CityResponse::name, CityResponse::id));
        LocalDate today = LocalDate.now(clock);
        SAMPLE_TRIPS.forEach(sample -> tripService.create(new TripRequest(sample.title(),
                sample.stops().stream().map(name -> new TripStopRequest(cityIds.get(name))).toList(),
                today.plusDays(sample.daysAhead()), sample.travelers(), sample.priority(), sample.notes()),
                demo.id()));
        log.info("Demo account {} created with {} sample trips", properties.email(), SAMPLE_TRIPS.size());
    }
}
