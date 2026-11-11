package com.routewise.comparison.controller;

import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.service.ComparisonService;

import io.swagger.v3.oas.annotations.Operation;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ComparisonController {

    private final ComparisonService comparisonService;

    public ComparisonController(ComparisonService comparisonService) {
        this.comparisonService = comparisonService;
    }

    @GetMapping("/api/trips/{tripId}/comparison")
    @Operation(summary = "Compare transport modes for a trip by time, cost and CO2, "
            + "weather-adjusted, with a recommendation")
    public ComparisonResponse compare(@PathVariable Long tripId) {
        return comparisonService.compare(tripId);
    }
}
