package com.routewise.transportmode.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.common.config.SecurityConfig;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.transportmode.dto.TransportModeResponse;
import com.routewise.transportmode.service.TransportModeService;
import com.routewise.user.TestUsers;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

@Import(SecurityConfig.class)
@WebMvcTest(TransportModeController.class)
class TransportModeControllerTest {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUpMockMvc() {
        mockMvc = TestUsers.mockMvcAsAlice(context);
    }

    @MockitoBean
    private TransportModeService transportModeService;

    @Test
    void findAll_returnsModes() throws Exception {
        when(transportModeService.findAll()).thenReturn(List.of(
                new TransportModeResponse(TransportModeCode.TRAIN, 110, new BigDecimal("0.120"), 35, 30, 2000)));

        mockMvc.perform(get("/api/transport-modes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("TRAIN"))
                .andExpect(jsonPath("$[0].avgSpeedKmh").value(110))
                .andExpect(jsonPath("$[0].costPerKm").value(0.12))
                .andExpect(jsonPath("$[0].co2GramsPerKm").value(35))
                .andExpect(jsonPath("$[0].fixedOverheadMinutes").value(30))
                .andExpect(jsonPath("$[0].maxDistanceKm").value(2000));
    }
}
