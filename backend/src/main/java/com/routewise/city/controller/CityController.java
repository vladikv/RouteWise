package com.routewise.city.controller;

import java.util.List;

import com.routewise.city.dto.CityResponse;
import com.routewise.city.service.CityService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.Size;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cities")
public class CityController {

    private final CityService cityService;

    public CityController(CityService cityService) {
        this.cityService = cityService;
    }

    @GetMapping
    @Operation(summary = "List cities, optionally filtered by name (for autocomplete)")
    public List<CityResponse> findAll(
            @Parameter(description = "Case-insensitive part of the city name")
            @RequestParam(required = false) @Size(max = 100) String q) {
        return cityService.findAll(q);
    }
}
