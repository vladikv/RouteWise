package com.routewise.comparison.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.WeatherSummary;
import com.routewise.comparison.service.ComparisonService;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;
import com.routewise.weather.domain.WeatherHazard;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ComparisonController.class)
class ComparisonControllerTest {

    private static final LocalDate DEPARTURE = LocalDate.of(2026, 11, 20);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ComparisonService comparisonService;

    @Test
    void compare_returnsComparison() throws Exception {
        when(comparisonService.compare(1L)).thenReturn(new ComparisonResponse(1L, DEPARTURE, 2,
                TripPriority.GREENEST, new BigDecimal("523.6"), "EUR",
                List.of(new WeatherSummary("Vienna", DEPARTURE, "Rain", 4.0, 9.0, 90, 20.0,
                        Set.of(WeatherHazard.RAIN))),
                List.of(
                        new ModeOptionResponse(TransportModeCode.TRAIN, true, null, new BigDecimal("628.3"), 373,
                                new BigDecimal("150.80"), new BigDecimal("44.0"), 87, true, List.of()),
                        new ModeOptionResponse(TransportModeCode.BIKE, false,
                                "Route of 681 km exceeds the BIKE limit of 150 km", new BigDecimal("680.7"),
                                null, null, null, 0, false, List.of()))));

        mockMvc.perform(get("/api/trips/1/comparison"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tripId").value(1))
                .andExpect(jsonPath("$.distanceKm").value(523.6))
                .andExpect(jsonPath("$.currency").value("EUR"))
                .andExpect(jsonPath("$.weather[0].city").value("Vienna"))
                .andExpect(jsonPath("$.weather[0].hazards[0]").value("RAIN"))
                .andExpect(jsonPath("$.options[0].mode").value("TRAIN"))
                .andExpect(jsonPath("$.options[0].recommended").value(true))
                .andExpect(jsonPath("$.options[0].totalCost").value(150.80))
                .andExpect(jsonPath("$.options[1].available").value(false))
                .andExpect(jsonPath("$.options[1].durationMinutes").doesNotExist())
                .andExpect(jsonPath("$.options[1].unavailableReason")
                        .value("Route of 681 km exceeds the BIKE limit of 150 km"));
    }

    @Test
    void compare_withNonNumericId_returns400ProblemDetail() throws Exception {
        mockMvc.perform(get("/api/trips/abc/comparison"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void compare_whenTripMissing_returns404() throws Exception {
        when(comparisonService.compare(42L)).thenThrow(new ResourceNotFoundException("Trip", 42L));

        mockMvc.perform(get("/api/trips/42/comparison"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("Trip with id 42 not found"));
    }
}
