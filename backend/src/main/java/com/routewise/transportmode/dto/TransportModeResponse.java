package com.routewise.transportmode.dto;

import java.math.BigDecimal;

import com.routewise.transportmode.domain.TransportModeCode;

public record TransportModeResponse(
        TransportModeCode code,
        int avgSpeedKmh,
        BigDecimal costPerKm,
        int co2GramsPerKm,
        int fixedOverheadMinutes,
        int maxDistanceKm) {
}
