package com.routewise.advisor.dto;

import java.util.List;

import com.routewise.advisor.domain.AdvisorSource;
import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Explanation of a trip's recommended itinerary. The recommendation itself comes
 * from the comparison engine, whatever the source of the wording.
 *
 * @param recommendedModes one entry per leg; an entry is {@code null} when no mode is available on that leg
 * @param legs             one sentence per leg explaining its recommended mode
 * @param tips             alternatives, weather and practical hints; may be empty
 */
public record AdviceResponse(
        Long tripId,
        List<TransportModeCode> recommendedModes,
        String summary,
        List<String> legs,
        List<String> tips,
        AdvisorSource source) {
}
