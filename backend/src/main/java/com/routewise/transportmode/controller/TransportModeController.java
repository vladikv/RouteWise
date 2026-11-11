package com.routewise.transportmode.controller;

import java.util.List;

import com.routewise.transportmode.dto.TransportModeResponse;
import com.routewise.transportmode.service.TransportModeService;

import io.swagger.v3.oas.annotations.Operation;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transport-modes")
public class TransportModeController {

    private final TransportModeService transportModeService;

    public TransportModeController(TransportModeService transportModeService) {
        this.transportModeService = transportModeService;
    }

    @GetMapping
    @Operation(summary = "List transport modes with the parameters used for comparison")
    public List<TransportModeResponse> findAll() {
        return transportModeService.findAll();
    }
}
