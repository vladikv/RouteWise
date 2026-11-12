package com.routewise.advisor.domain;

import java.util.List;

import com.routewise.comparison.dto.ComparisonResponse;

/**
 * Everything the advisor explains: the trip's stop cities in order and its
 * weather-aware, per-leg comparison.
 */
public record AdviceContext(List<String> stops, ComparisonResponse comparison) {

    /** E.g. "Berlin → Prague → Vienna". */
    public String route() {
        return String.join(" → ", stops);
    }
}
