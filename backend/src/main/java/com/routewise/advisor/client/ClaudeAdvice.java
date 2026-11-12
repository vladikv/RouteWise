package com.routewise.advisor.client;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

/**
 * Structured output schema for advice.
 */
record ClaudeAdvice(
        @JsonPropertyDescription("One or two sentences: the recommended plan for the whole route and why")
        String summary,
        @JsonPropertyDescription("Exactly one short sentence per leg, in leg order: the recommended mode for that "
                + "leg and why")
        List<String> legs,
        @JsonPropertyDescription("Up to 4 short tips: the best single-mode alternative, weather, practical hints")
        List<String> tips) {
}
