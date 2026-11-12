package com.routewise.comparison.controller;

import com.routewise.comparison.dto.ComparisonRequest;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.service.ComparisonService;
import com.routewise.user.domain.AuthUser;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    public ComparisonResponse compare(@PathVariable Long tripId, @AuthenticationPrincipal AuthUser user) {
        return comparisonService.compare(tripId, user.id());
    }

    @PostMapping("/api/comparisons")
    @Operation(summary = "Compare transport modes for a route without storing a trip")
    public ComparisonResponse preview(@Valid @RequestBody ComparisonRequest request) {
        return comparisonService.preview(request);
    }
}
