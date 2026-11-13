package com.routewise.trip.repository;

import java.time.LocalDate;
import java.util.Locale;

import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripStop;

import jakarta.persistence.criteria.Subquery;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

/**
 * Filters on stored trip columns for {@code JpaSpecificationExecutor}. Each one is a small,
 * combinable predicate; a {@code null} or blank argument means "no restriction".
 */
public final class TripSpecifications {

    private static final char ESCAPE = '\\';

    private TripSpecifications() {
    }

    public static Specification<Trip> ownedBy(Long ownerId) {
        return (trip, query, cb) -> cb.equal(trip.get("ownerId"), ownerId);
    }

    public static Specification<Trip> active() {
        return (trip, query, cb) -> cb.isNull(trip.get("deletedAt"));
    }

    /**
     * Case-insensitive "contains" over the title and the names of the stop cities. Cities are
     * matched with an EXISTS subquery, so a trip visiting two matching cities is returned once.
     */
    public static Specification<Trip> matches(String text) {
        if (!StringUtils.hasText(text)) {
            return Specification.unrestricted();
        }
        String pattern = "%" + escapeLike(text.strip().toLowerCase(Locale.ROOT)) + "%";
        return (trip, query, cb) -> {
            Subquery<Long> cityMatch = query.subquery(Long.class);
            var stop = cityMatch.from(TripStop.class);
            cityMatch.select(stop.get("id")).where(
                    cb.equal(stop.get("trip"), trip),
                    cb.like(cb.lower(stop.get("city").get("name")), pattern, ESCAPE));
            return cb.or(cb.like(cb.lower(trip.get("title")), pattern, ESCAPE), cb.exists(cityMatch));
        };
    }

    /** Departure on or after {@code from}. */
    public static Specification<Trip> departingFrom(LocalDate from) {
        return from == null
                ? Specification.unrestricted()
                : (trip, query, cb) -> cb.greaterThanOrEqualTo(trip.get("departureDate"), from);
    }

    /** Departure on or before {@code to}. */
    public static Specification<Trip> departingUntil(LocalDate to) {
        return to == null
                ? Specification.unrestricted()
                : (trip, query, cb) -> cb.lessThanOrEqualTo(trip.get("departureDate"), to);
    }

    /** Searched text is literal: {@code %} and {@code _} do not act as wildcards. */
    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
