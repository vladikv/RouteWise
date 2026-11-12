package com.routewise.city.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import com.routewise.city.dto.CityResponse;
import com.routewise.city.service.CityService;
import com.routewise.common.config.SecurityConfig;
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
@WebMvcTest(CityController.class)
class CityControllerTest {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUpMockMvc() {
        mockMvc = TestUsers.mockMvcAsAlice(context);
    }

    @MockitoBean
    private CityService cityService;

    @Test
    void findAll_returnsCities() throws Exception {
        when(cityService.findAll(null)).thenReturn(List.of(new CityResponse(1L, "Berlin", "DE", 52.52, 13.405)));

        mockMvc.perform(get("/api/cities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Berlin"))
                .andExpect(jsonPath("$[0].country").value("DE"))
                .andExpect(jsonPath("$[0].latitude").value(52.52));
    }

    @Test
    void findAll_withQuery_passesItToService() throws Exception {
        when(cityService.findAll("ber")).thenReturn(List.of());

        mockMvc.perform(get("/api/cities").param("q", "ber"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void findAll_withTooLongQuery_returns400() throws Exception {
        mockMvc.perform(get("/api/cities").param("q", "x".repeat(101)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("q"));
    }
}
