package com.routewise.advisor.domain;

import com.routewise.comparison.dto.ComparisonResponse;

/**
 * Everything the advisor explains: the trip's cities and its weather-aware comparison.
 */
public record AdviceContext(String originCity, String destinationCity, ComparisonResponse comparison) {
}
