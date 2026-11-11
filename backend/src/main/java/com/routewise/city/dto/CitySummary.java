package com.routewise.city.dto;

/**
 * Compact city reference embedded in other resources, e.g. a trip's origin.
 */
public record CitySummary(Long id, String name, String country) {
}
