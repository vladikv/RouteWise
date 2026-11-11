package com.routewise.advisor.client;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

/**
 * Structured output schema for advice.
 */
record ClaudeAdvice(
        @JsonPropertyDescription("One or two sentences: which mode to take and why")
        String summary,
        @JsonPropertyDescription("Up to 4 short tips: the best alternative, weather, practical hints")
        List<String> tips) {
}
