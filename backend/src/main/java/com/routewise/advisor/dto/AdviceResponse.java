package com.routewise.advisor.dto;

import java.util.List;

import com.routewise.advisor.domain.AdvisorSource;
import com.routewise.transportmode.domain.TransportModeCode;

/**
 * Explanation of a trip's recommendation. The recommendation itself comes from
 * the comparison engine, whatever the source of the wording.
 *
 * @param recommendedMode {@code null} when no mode is available
 * @param tips            alternatives, weather and practical hints; may be empty
 */
public record AdviceResponse(
        Long tripId,
        TransportModeCode recommendedMode,
        String summary,
        List<String> tips,
        AdvisorSource source) {
}
