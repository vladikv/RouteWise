package com.routewise.advisor.domain;

import java.util.List;

/**
 * Human-readable explanation of a recommendation.
 *
 * @param summary one or two sentences: the recommended plan and why
 * @param legs    one short sentence per leg, in leg order
 * @param tips    short additional points (alternatives, weather), may be empty
 */
public record AdviceText(String summary, List<String> legs, List<String> tips) {
}
