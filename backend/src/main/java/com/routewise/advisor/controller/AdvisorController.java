package com.routewise.advisor.controller;

import com.routewise.advisor.dto.AdviceResponse;
import com.routewise.advisor.dto.TripDraftResponse;
import com.routewise.advisor.dto.TripParseRequest;
import com.routewise.advisor.service.AdvisorService;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AdvisorController {

    private final AdvisorService advisorService;

    public AdvisorController(AdvisorService advisorService) {
        this.advisorService = advisorService;
    }

    @PostMapping("/api/advisor/parse")
    @Operation(summary = "Turn a free-text trip request into a trip draft (not stored); "
            + "uses the AI advisor if configured, otherwise rules")
    public TripDraftResponse parse(@Valid @RequestBody TripParseRequest request) {
        return advisorService.parse(request.text());
    }

    @GetMapping("/api/trips/{tripId}/advice")
    @Operation(summary = "Explain the weather-aware recommendation for a trip; "
            + "uses the AI advisor if configured, otherwise rules")
    public AdviceResponse advise(@PathVariable Long tripId) {
        return advisorService.advise(tripId);
    }
}
