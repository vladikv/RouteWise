package com.routewise.advisor.domain;

import java.util.List;

/**
 * Human-readable explanation of a recommendation.
 *
 * @param summary one or two sentences: what to take and why
 * @param tips    short additional points (alternatives, weather), may be empty
 */
public record AdviceText(String summary, List<String> tips) {
}
