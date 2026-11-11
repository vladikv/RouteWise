package com.routewise.transportmode.mapper;

import com.routewise.transportmode.domain.TransportMode;
import com.routewise.transportmode.dto.TransportModeResponse;

import org.springframework.stereotype.Component;

@Component
public class TransportModeMapper {

    public TransportModeResponse toResponse(TransportMode mode) {
        return new TransportModeResponse(mode.getCode(), mode.getAvgSpeedKmh(), mode.getCostPerKm(),
                mode.getCo2GramsPerKm(), mode.getFixedOverheadMinutes(), mode.getMaxDistanceKm());
    }
}
