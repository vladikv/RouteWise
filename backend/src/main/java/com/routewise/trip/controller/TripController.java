package com.routewise.trip.controller;

import java.net.URI;

import com.routewise.trip.dto.TripPageResponse;
import com.routewise.trip.dto.TripRequest;
import com.routewise.trip.dto.TripResponse;
import com.routewise.trip.dto.TripSearchParams;
import com.routewise.trip.dto.TripStatsResponse;
import com.routewise.trip.service.TripQueryService;
import com.routewise.trip.service.TripService;
import com.routewise.trip.service.TripStatsService;
import com.routewise.user.domain.AuthUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;
    private final TripQueryService tripQueryService;
    private final TripStatsService tripStatsService;

    public TripController(TripService tripService, TripQueryService tripQueryService,
                          TripStatsService tripStatsService) {
        this.tripService = tripService;
        this.tripQueryService = tripQueryService;
        this.tripStatsService = tripStatsService;
    }

    @GetMapping
    @Operation(summary = "Search your trips",
            description = "Text search, filters, sorting and paging. Each item carries its weather-free figures; "
                    + "facets count the trips per chip (each dimension ignores its own filter) and priorityTotals "
                    + "summarise every matching trip. 400 for invalid parameters or from after to.")
    public TripPageResponse search(@ParameterObject @Valid TripSearchParams params,
                                   @AuthenticationPrincipal AuthUser user) {
        return tripQueryService.search(params, user.id());
    }

    @GetMapping("/stats")
    @Operation(summary = "Key figures over your active trips",
            description = "Trips planned, CO2 saved against driving, average cost and the next trip; "
                    + "list filters do not apply and deleted trips are not counted.")
    public TripStatsResponse stats(@AuthenticationPrincipal AuthUser user) {
        return tripStatsService.stats(user.id());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get trip details")
    public TripResponse findById(@PathVariable Long id, @AuthenticationPrincipal AuthUser user) {
        return tripService.findById(id, user.id());
    }

    @PostMapping
    @Operation(summary = "Create a trip")
    public ResponseEntity<TripResponse> create(@Valid @RequestBody TripRequest request,
                                               @AuthenticationPrincipal AuthUser user) {
        TripResponse created = tripService.create(request, user.id());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Replace all editable fields of a trip")
    public TripResponse update(@PathVariable Long id, @Valid @RequestBody TripRequest request,
                               @AuthenticationPrincipal AuthUser user) {
        return tripService.update(id, request, user.id());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a trip",
            description = "Soft delete: the trip is hidden everywhere and can be restored within the restore window "
                    + "(routewise.trips.restore-window, default 30 s). A deleted trip answers 404.")
    public void delete(@PathVariable Long id, @AuthenticationPrincipal AuthUser user) {
        tripService.delete(id, user.id());
    }

    @PostMapping("/{id}/restore")
    @Operation(summary = "Restore a deleted trip (undo)",
            description = "200 with the trip, also when it is not deleted. 409 after the restore window; "
                    + "404 for an unknown or another user's trip.")
    @ApiResponse(responseCode = "200", description = "Trip restored or already active")
    @ApiResponse(responseCode = "404", description = "Unknown trip or another user's trip")
    @ApiResponse(responseCode = "409", description = "The restore window has passed")
    public TripResponse restore(@PathVariable Long id, @AuthenticationPrincipal AuthUser user) {
        return tripService.restore(id, user.id());
    }
}
