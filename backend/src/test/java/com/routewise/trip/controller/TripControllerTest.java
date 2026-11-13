package com.routewise.trip.controller;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import com.routewise.common.config.SecurityConfig;
import com.routewise.common.exception.ConflictException;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.dto.TripRequest;
import com.routewise.trip.dto.TripResponse;
import com.routewise.trip.dto.TripStopRequest;
import com.routewise.trip.dto.TripStopResponse;
import com.routewise.trip.service.TripService;
import com.routewise.user.TestUsers;

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
@WebMvcTest(TripController.class)
class TripControllerTest {

    private static final LocalDate DEPARTURE = LocalDate.now().plusDays(7);
    private static final Instant NOW = Instant.parse("2026-11-11T10:00:00Z");

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUpMockMvc() {
        mockMvc = TestUsers.mockMvcAsAlice(context);
    }

    @MockitoBean
    private TripService tripService;

    @Test
    void findAll_returnsTrips() throws Exception {
        when(tripService.findAll(TestUsers.ALICE_ID)).thenReturn(List.of(response(1L)));

        mockMvc.perform(get("/api/trips"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].stops[0].cityName").value("Berlin"))
                .andExpect(jsonPath("$[0].stops[1].country").value("AT"))
                .andExpect(jsonPath("$[0].stops[1].position").value(1));
    }

    @Test
    void findById_returnsTrip() throws Exception {
        when(tripService.findById(1L, TestUsers.ALICE_ID)).thenReturn(response(1L));

        mockMvc.perform(get("/api/trips/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Weekend in Vienna"))
                .andExpect(jsonPath("$.departureDate").value(DEPARTURE.toString()))
                .andExpect(jsonPath("$.travelers").value(2))
                .andExpect(jsonPath("$.priority").value("GREENEST"))
                .andExpect(jsonPath("$.createdAt").value("2026-11-11T10:00:00Z"));
    }

    @Test
    void findById_whenMissing_returns404() throws Exception {
        when(tripService.findById(42L, TestUsers.ALICE_ID)).thenThrow(new ResourceNotFoundException("Trip", 42L));

        mockMvc.perform(get("/api/trips/42"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("Trip with id 42 not found"));
    }

    @Test
    void create_returns201WithLocation() throws Exception {
        when(tripService.create(any(TripRequest.class), eq(TestUsers.ALICE_ID))).thenReturn(response(7L));

        mockMvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "http://localhost/api/trips/7"))
                .andExpect(jsonPath("$.id").value(7));

        verify(tripService).create(new TripRequest("Weekend in Vienna",
                List.of(new TripStopRequest(1L), new TripStopRequest(2L)), DEPARTURE, 2,
                TripPriority.GREENEST, null), TestUsers.ALICE_ID);
    }

    @Test
    void create_withInvalidBody_returns400WithFieldErrors() throws Exception {
        String body = """
                {"title": "", "stops": [{"cityId": 1}, {"cityId": null}],
                 "departureDate": null, "travelers": 10, "priority": "GREENEST"}
                """;

        mockMvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field")
                        .value(containsInAnyOrder("title", "stops[1].cityId", "departureDate", "travelers")));
        verifyNoInteractions(tripService);
    }

    @Test
    void create_withOneStop_returns400() throws Exception {
        String body = validBody().replace("[{\"cityId\": 1}, {\"cityId\": 2}]", "[{\"cityId\": 1}]");

        mockMvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("stops"))
                .andExpect(jsonPath("$.errors[0].message").value("size must be between 2 and 10"));
        verifyNoInteractions(tripService);
    }

    @Test
    void create_withElevenStops_returns400() throws Exception {
        String elevenStops = IntStream.rangeClosed(1, 11)
                .mapToObj(i -> "{\"cityId\": %d}".formatted(i % 2 + 1))
                .collect(Collectors.joining(", ", "[", "]"));
        String body = validBody().replace("[{\"cityId\": 1}, {\"cityId\": 2}]", elevenStops);

        mockMvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("stops"));
        verifyNoInteractions(tripService);
    }

    @Test
    void create_withUnknownPriority_returns400() throws Exception {
        String body = validBody().replace("GREENEST", "SLOWEST");

        mockMvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
        verifyNoInteractions(tripService);
    }

    @Test
    void create_withUnknownCity_returns400WithFieldError() throws Exception {
        when(tripService.create(any(TripRequest.class), eq(TestUsers.ALICE_ID)))
                .thenThrow(new FieldValidationException("stops[1].cityId", "unknown city id 2"));

        mockMvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[0].field").value("stops[1].cityId"))
                .andExpect(jsonPath("$.errors[0].message").value("unknown city id 2"));
    }

    @Test
    void update_returnsUpdatedTrip() throws Exception {
        when(tripService.update(eq(1L), any(TripRequest.class), eq(TestUsers.ALICE_ID))).thenReturn(response(1L));

        mockMvc.perform(put("/api/trips/1").contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void update_withInvalidBody_returns400() throws Exception {
        mockMvc.perform(put("/api/trips/1").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").isNotEmpty());
        verifyNoInteractions(tripService);
    }

    @Test
    void update_whenMissing_returns404() throws Exception {
        when(tripService.update(eq(42L), any(TripRequest.class), eq(TestUsers.ALICE_ID)))
                .thenThrow(new ResourceNotFoundException("Trip", 42L));

        mockMvc.perform(put("/api/trips/42").contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_returns204() throws Exception {
        mockMvc.perform(delete("/api/trips/1"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
        verify(tripService).delete(1L, TestUsers.ALICE_ID);
    }

    @Test
    void delete_whenMissing_returns404() throws Exception {
        doThrow(new ResourceNotFoundException("Trip", 42L)).when(tripService).delete(42L, TestUsers.ALICE_ID);

        mockMvc.perform(delete("/api/trips/42"))
                .andExpect(status().isNotFound());
    }

    @Test
    void restore_returns200WithTrip() throws Exception {
        when(tripService.restore(1L, TestUsers.ALICE_ID)).thenReturn(response(1L));

        mockMvc.perform(post("/api/trips/1/restore"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void restore_afterTheWindow_returns409ProblemDetails() throws Exception {
        when(tripService.restore(1L, TestUsers.ALICE_ID))
                .thenThrow(new ConflictException("Trip 1 can no longer be restored"));

        mockMvc.perform(post("/api/trips/1/restore"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value("Trip 1 can no longer be restored"));
    }

    @Test
    void restore_whenMissing_returns404() throws Exception {
        when(tripService.restore(42L, TestUsers.ALICE_ID)).thenThrow(new ResourceNotFoundException("Trip", 42L));

        mockMvc.perform(post("/api/trips/42/restore"))
                .andExpect(status().isNotFound());
    }

    @Test
    void restore_whenLoggedOut_returns401() throws Exception {
        TestUsers.anonymousMockMvc(context).perform(post("/api/trips/1/restore"))
                .andExpect(status().isUnauthorized());
    }

    private static String validBody() {
        return """
                {"title": "Weekend in Vienna", "stops": [{"cityId": 1}, {"cityId": 2}],
                 "departureDate": "%s", "travelers": 2, "priority": "GREENEST"}
                """.formatted(DEPARTURE);
    }

    private static TripResponse response(Long id) {
        return new TripResponse(id, "Weekend in Vienna",
                List.of(new TripStopResponse(1L, "Berlin", "DE", 0), new TripStopResponse(2L, "Vienna", "AT", 1)),
                DEPARTURE, 2, TripPriority.GREENEST, null, NOW, NOW);
    }
}
