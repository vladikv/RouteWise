package com.routewise.comparison.domain;

import java.util.List;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Modes that cannot be used for the same reason, with one readable sentence for all of them,
 * e.g. "Not reachable by land between Dublin and Madrid: train, bus, car, bike".
 *
 * @param modes in {@link TransportModeCode} order
 */
public record UnavailableGroup(UnavailableCode code, List<TransportModeCode> modes, String message) {
}
