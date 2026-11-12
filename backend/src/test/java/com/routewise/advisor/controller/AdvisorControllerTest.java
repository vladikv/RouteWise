package com.routewise.advisor.controller;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import com.routewise.advisor.domain.AdvisorSource;
import com.routewise.advisor.dto.AdviceResponse;
import com.routewise.advisor.dto.TripDraftResponse;
import com.routewise.advisor.service.AdvisorService;
import com.routewise.city.dto.CitySummary;
import com.routewise.common.config.SecurityConfig;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;
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
@WebMvcTest(AdvisorController.class)
class AdvisorControllerTest {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUpMockMvc() {
        mockMvc = TestUsers.mockMvcAsAlice(context);
    }

    @MockitoBean
    private AdvisorService advisorService;

    @Test
    void parse_returnsDraft() throws Exception {
        when(advisorService.parse("Berlin to Vienna tomorrow")).thenReturn(new TripDraftResponse(
                "Berlin to Vienna", new CitySummary(1L, "Berlin", "DE"), null, LocalDate.of(2026, 11, 12), 1,
                TripPriority.BALANCED, null, AdvisorSource.RULES, List.of("\"Wien\" is not a supported city.")));

        mockMvc.perform(post("/api/advisor/parse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"text": "Berlin to Vienna tomorrow"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Berlin to Vienna"))
                .andExpect(jsonPath("$.origin.id").value(1))
                .andExpect(jsonPath("$.origin.name").value("Berlin"))
                .andExpect(jsonPath("$.destination").doesNotExist())
                .andExpect(jsonPath("$.departureDate").value("2026-11-12"))
                .andExpect(jsonPath("$.travelers").value(1))
                .andExpect(jsonPath("$.priority").value("BALANCED"))
                .andExpect(jsonPath("$.source").value("RULES"))
                .andExpect(jsonPath("$.warnings[0]").value("\"Wien\" is not a supported city."));
    }

    @Test
    void parse_withBlankText_returns400WithFieldError() throws Exception {
        mockMvc.perform(post("/api/advisor/parse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"text": "   "}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.errors[0].field").value("text"));
        verifyNoInteractions(advisorService);
    }

    @Test
    void parse_withTooLongText_returns400() throws Exception {
        mockMvc.perform(post("/api/advisor/parse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\": \"" + "a".repeat(1001) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("text"));
    }

    @Test
    void parse_withMissingBody_returns400() throws Exception {
        mockMvc.perform(post("/api/advisor/parse").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void advise_returnsAdvice() throws Exception {
        when(advisorService.advise(1L, TestUsers.ALICE_ID)).thenReturn(new AdviceResponse(1L, TransportModeCode.TRAIN,
                "Take the train.", List.of("Pack an umbrella."), AdvisorSource.AI));

        mockMvc.perform(get("/api/trips/1/advice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tripId").value(1))
                .andExpect(jsonPath("$.recommendedMode").value("TRAIN"))
                .andExpect(jsonPath("$.summary").value("Take the train."))
                .andExpect(jsonPath("$.tips[0]").value("Pack an umbrella."))
                .andExpect(jsonPath("$.source").value("AI"));
    }

    @Test
    void advise_withNonNumericId_returns400ProblemDetail() throws Exception {
        mockMvc.perform(get("/api/trips/abc/advice"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void advise_whenTripMissing_returns404() throws Exception {
        when(advisorService.advise(42L, TestUsers.ALICE_ID)).thenThrow(new ResourceNotFoundException("Trip", 42L));

        mockMvc.perform(get("/api/trips/42/advice"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(404));
    }
}
