package com.routewise.trip.dto;

import java.time.LocalDate;
import java.util.List;

import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;

import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.format.annotation.DateTimeFormat;

/**
 * Query parameters of {@code GET /api/trips}; absent values take the defaults below.
 */
public record TripSearchParams(
        @Parameter(description = "Case-insensitive text in the title or a stop city name")
        @Size(max = 100) String q,
        @Parameter(description = "Priorities to include (repeatable); none = all")
        List<TripPriority> priority,
        @Parameter(description = "Modes of the recommended plan to include (repeatable); none = all")
        List<TransportModeCode> mode,
        @Parameter(description = "Earliest departure date, inclusive")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @Parameter(description = "Latest departure date, inclusive")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @Parameter(description = "date (default), cost or co2")
        @Pattern(regexp = "date|cost|co2", message = "must be date, cost or co2") String sort,
        @Parameter(description = "asc (default) or desc")
        @Pattern(regexp = "asc|desc", message = "must be asc or desc") String direction,
        @Parameter(description = "0-based page, default 0")
        @Min(0) Integer page,
        @Parameter(description = "Page size 1-100, default 20")
        @Min(1) @Max(100) Integer size) {

    public static final int DEFAULT_SIZE = 20;
}
