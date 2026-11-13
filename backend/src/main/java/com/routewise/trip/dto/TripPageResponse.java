package com.routewise.trip.dto;

import java.util.List;

/**
 * One page of a trip search.
 *
 * @param page           0-based; a page past the end has no items
 * @param totalItems     trips matching every filter
 * @param facets         counts for the filter chips; each dimension ignores its own filter
 * @param priorityTotals per priority over all matching trips (not only this page), for the board columns
 */
public record TripPageResponse(
        List<TripListItemResponse> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        String currency,
        TripFacetsResponse facets,
        List<PriorityTotalResponse> priorityTotals) {
}
