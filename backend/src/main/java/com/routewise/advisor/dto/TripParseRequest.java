package com.routewise.advisor.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/advisor/parse}.
 *
 * @param text free-text trip request, e.g. "Berlin to Vienna next Friday, 2 people, cheap"
 */
public record TripParseRequest(@NotBlank @Size(max = 1000) String text) {
}
