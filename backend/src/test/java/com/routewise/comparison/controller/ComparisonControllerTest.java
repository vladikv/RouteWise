package com.routewise.comparison.controller;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import com.routewise.city.dto.CitySummary;
import com.routewise.common.config.SecurityConfig;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.comparison.dto.ComparisonRequest;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ItineraryTotalsResponse;
import com.routewise.comparison.dto.LegResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.ModeTotalsResponse;
import com.routewise.comparison.dto.WeatherSummary;
import com.routewise.comparison.service.ComparisonService;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.dto.TripStopRequest;
import com.routewise.user.TestUsers;
import com.routewise.weather.domain.WeatherHazard;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

@Import(SecurityConfig.class)
@WebMvcTest(ComparisonController.class)
class ComparisonControllerTest {

    private static final LocalDate DEPARTURE = LocalDate.of(2026, 11, 20);

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUpMockMvc() {
        mockMvc = TestUsers.mockMvcAsAlice(context);
    }

    @MockitoBean
    private ComparisonService comparisonService;

    @Test
    void compare_returnsComparison() throws Exception {
        when(comparisonService.compare(1L, TestUsers.ALICE_ID)).thenReturn(response(1L,
                List.of(new WeatherSummary("Vienna", DEPARTURE, "Rain", 4.0, 9.0, 90, 20.0,
                        Set.of(WeatherHazard.RAIN)))));

        mockMvc.perform(get("/api/trips/1/comparison"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tripId").value(1))
                .andExpect(jsonPath("$.distanceKm").value(523.6))
                .andExpect(jsonPath("$.currency").value("EUR"))
                .andExpect(jsonPath("$.weather[0].city").value("Vienna"))
                .andExpect(jsonPath("$.weather[0].hazards[0]").value("RAIN"))
                .andExpect(jsonPath("$.legs[0].index").value(0))
                .andExpect(jsonPath("$.legs[0].from.name").value("Berlin"))
                .andExpect(jsonPath("$.legs[0].to.name").value("Vienna"))
                .andExpect(jsonPath("$.legs[0].recommendedMode").value("TRAIN"))
                .andExpect(jsonPath("$.legs[0].options[0].mode").value("TRAIN"))
                .andExpect(jsonPath("$.legs[0].options[0].totalCost").value(150.80))
                .andExpect(jsonPath("$.legs[0].options[1].available").value(false))
                .andExpect(jsonPath("$.legs[0].options[1].durationMinutes").doesNotExist())
                .andExpect(jsonPath("$.legs[0].options[1].unavailableCode").value("TOO_FAR"))
                .andExpect(jsonPath("$.legs[0].options[0].unavailableCode").doesNotExist())
                .andExpect(jsonPath("$.legs[0].options[1].unavailableReason")
                        .value("Route of 681 km exceeds the BIKE limit of 150 km"))
                .andExpect(jsonPath("$.recommendedItinerary.modes[0]").value("TRAIN"))
                .andExpect(jsonPath("$.recommendedItinerary.durationMinutes").value(373))
                .andExpect(jsonPath("$.singleModeTotals[0].mode").value("TRAIN"))
                .andExpect(jsonPath("$.singleModeTotals[1].available").value(false))
                .andExpect(jsonPath("$.singleModeTotals[1].unavailableCode").value("TOO_FAR"))
                .andExpect(jsonPath("$.singleModeTotals[1].totalCost").doesNotExist());
    }

    @Test
    void compare_withNonNumericId_returns400ProblemDetail() throws Exception {
        mockMvc.perform(get("/api/trips/abc/comparison"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void preview_returnsComparisonWithoutTripId() throws Exception {
        when(comparisonService.preview(new ComparisonRequest(stops(3L, 23L), DEPARTURE, 2,
                TripPriority.GREENEST))).thenReturn(response(null, List.of()));

        mockMvc.perform(post("/api/comparisons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stops": [{"cityId": 3}, {"cityId": 23}], "departureDate": "2026-11-20",
                                 "travelers": 2, "priority": "GREENEST"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tripId").doesNotExist())
                .andExpect(jsonPath("$.priority").value("GREENEST"))
                .andExpect(jsonPath("$.legs[0].options[0].mode").value("TRAIN"))
                .andExpect(jsonPath("$.legs[0].options[0].recommended").value(true));
    }

    @Test
    void preview_withInvalidBody_returns400WithFieldErrors() throws Exception {
        mockMvc.perform(post("/api/comparisons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stops": [{"cityId": 3}], "departureDate": "2026-11-20", "travelers": 12,
                                 "priority": "GREENEST"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.errors[?(@.field == 'stops')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'travelers')]").exists());
        verifyNoInteractions(comparisonService);
    }

    @Test
    void preview_whenServiceRejectsARule_returns400WithFieldError() throws Exception {
        when(comparisonService.preview(new ComparisonRequest(stops(3L, 3L), DEPARTURE, 2, TripPriority.GREENEST)))
                .thenThrow(new FieldValidationException("stops[1].cityId", "must differ from the previous stop"));

        mockMvc.perform(post("/api/comparisons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stops": [{"cityId": 3}, {"cityId": 3}], "departureDate": "2026-11-20",
                                 "travelers": 2, "priority": "GREENEST"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("stops[1].cityId"))
                .andExpect(jsonPath("$.errors[0].message").value("must differ from the previous stop"));
    }

    @Test
    void compare_whenTripMissing_returns404() throws Exception {
        when(comparisonService.compare(42L, TestUsers.ALICE_ID)).thenThrow(new ResourceNotFoundException("Trip", 42L));

        mockMvc.perform(get("/api/trips/42/comparison"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("Trip with id 42 not found"));
    }

    private static List<TripStopRequest> stops(Long... cityIds) {
        return Arrays.stream(cityIds).map(TripStopRequest::new).toList();
    }

    /** One leg Berlin to Vienna: train recommended, bike unavailable. */
    private static ComparisonResponse response(Long tripId, List<WeatherSummary> weather) {
        ModeOptionResponse train = new ModeOptionResponse(TransportModeCode.TRAIN, true, null, null,
                new BigDecimal("628.3"), 373, new BigDecimal("150.80"), new BigDecimal("44.0"), 87, true, List.of());
        ModeOptionResponse bike = new ModeOptionResponse(TransportModeCode.BIKE, false,
                UnavailableCode.TOO_FAR, "Route of 681 km exceeds the BIKE limit of 150 km", new BigDecimal("680.7"), null, null, null, 0,
                false, List.of());
        LegResponse leg = new LegResponse(0, new CitySummary(1L, "Berlin", "DE"), new CitySummary(2L, "Vienna", "AT"),
                new BigDecimal("523.6"), List.of(train, bike), TransportModeCode.TRAIN, List.of());
        return new ComparisonResponse(tripId, DEPARTURE, 2, TripPriority.GREENEST, new BigDecimal("523.6"), "EUR",
                weather, List.of(leg),
                new ItineraryTotalsResponse(List.of(TransportModeCode.TRAIN), 373, new BigDecimal("150.80"),
                        new BigDecimal("44.0")),
                List.of(new ModeTotalsResponse(TransportModeCode.TRAIN, true, null, null, 373, new BigDecimal("150.80"),
                                new BigDecimal("44.0")),
                        new ModeTotalsResponse(TransportModeCode.BIKE, false, UnavailableCode.TOO_FAR,
                                "Leg 1 (Berlin to Vienna): too far",
                                null, null, null)), List.of());
    }
}
