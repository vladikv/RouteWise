package com.routewise.comparison.dto;

import java.util.List;

import com.routewise.comparison.domain.UnavailableCode;
import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Modes ruled out for the same reason, with one readable sentence for all of them.
 *
 * @param modes   in the fixed order TRAIN, BUS, CAR, BIKE, PLANE
 * @param message e.g. "Not reachable by land between Dublin and Madrid: train, bus, car, bike"
 */
public record UnavailableGroupResponse(UnavailableCode code, List<TransportModeCode> modes, String message) {
}
