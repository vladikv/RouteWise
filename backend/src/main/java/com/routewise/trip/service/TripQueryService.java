package com.routewise.trip.service;

import static com.routewise.trip.repository.TripSpecifications.active;
import static com.routewise.trip.repository.TripSpecifications.departingFrom;
import static com.routewise.trip.repository.TripSpecifications.departingUntil;
import static com.routewise.trip.repository.TripSpecifications.matches;
import static com.routewise.trip.repository.TripSpecifications.ownedBy;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.function.Function;
import java.util.function.Predicate;

import com.routewise.common.exception.FieldValidationException;
import com.routewise.comparison.domain.ModeParameters;
import com.routewise.comparison.mapper.ComparisonMapper;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.transportmode.repository.TransportModeRepository;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripFigures;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.domain.TripSearchCriteria;
import com.routewise.trip.domain.TripSortKey;
import com.routewise.trip.dto.PriorityTotalResponse;
import com.routewise.trip.dto.TripFacetsResponse;
import com.routewise.trip.dto.TripFacetsResponse.ModeCount;
import com.routewise.trip.dto.TripFacetsResponse.PriorityCount;
import com.routewise.trip.dto.TripPageResponse;
import com.routewise.trip.dto.TripSearchParams;
import com.routewise.trip.mapper.TripMapper;
import com.routewise.trip.repository.TripRepository;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Trip list search. Stored columns (owner, not deleted, text, departure dates) are filtered in SQL
 * with {@link com.routewise.trip.repository.TripSpecifications}; everything that depends on the
 * computed figures (mode filter, facets, cost/CO2 sort) and the priority filter, which the priority
 * facet must ignore anyway, runs in memory on that candidate set, followed by the page slice.
 * Fine for one user's trips; no external calls (figures have no weather).
 */
@Service
@Transactional(readOnly = true)
public class TripQueryService {

    private final TripRepository tripRepository;
    private final TransportModeRepository transportModeRepository;
    private final ComparisonMapper comparisonMapper;
    private final TripFiguresCalculator figuresCalculator;
    private final TripMapper tripMapper;

    public TripQueryService(TripRepository tripRepository, TransportModeRepository transportModeRepository,
                            ComparisonMapper comparisonMapper, TripFiguresCalculator figuresCalculator,
                            TripMapper tripMapper) {
        this.tripRepository = tripRepository;
        this.transportModeRepository = transportModeRepository;
        this.comparisonMapper = comparisonMapper;
        this.figuresCalculator = figuresCalculator;
        this.tripMapper = tripMapper;
    }

    /**
     * @throws FieldValidationException when {@code from} is after {@code to}
     */
    public TripPageResponse search(TripSearchParams params, Long ownerId) {
        TripSearchCriteria criteria = criteria(params);
        List<FiguredTrip> candidates = figured(tripRepository.findAll(Specification.allOf(
                ownedBy(ownerId), active(), matches(criteria.query()),
                departingFrom(criteria.from()), departingUntil(criteria.to())), Sort.by("departureDate", "id")));

        Predicate<FiguredTrip> priorityFilter = byPriority(criteria.priorities());
        Predicate<FiguredTrip> modeFilter = byMode(criteria.modes());
        List<FiguredTrip> matching = candidates.stream().filter(priorityFilter.and(modeFilter))
                .sorted(order(criteria.sort(), criteria.descending()))
                .toList();

        int totalPages = (matching.size() + criteria.size() - 1) / criteria.size();
        List<FiguredTrip> page = matching.stream()
                .skip((long) criteria.page() * criteria.size())
                .limit(criteria.size())
                .toList();
        return new TripPageResponse(
                page.stream().map(item -> tripMapper.toListItem(item.trip(), item.figures().orElse(null))).toList(),
                criteria.page(),
                criteria.size(),
                matching.size(),
                totalPages,
                ComparisonMapper.CURRENCY,
                new TripFacetsResponse(
                        priorityCounts(candidates.stream().filter(modeFilter).toList()),
                        modeCounts(candidates.stream().filter(priorityFilter).toList())),
                priorityTotals(matching));
    }

    /** Active trips of the owner with their figures, soonest departure first. */
    public List<FiguredTrip> activeTrips(Long ownerId) {
        return figured(tripRepository.findAll(Specification.allOf(ownedBy(ownerId), active()),
                Sort.by("departureDate", "id")));
    }

    private List<FiguredTrip> figured(List<Trip> trips) {
        List<ModeParameters> modes = transportModeRepository.findAll().stream()
                .map(comparisonMapper::toParameters)
                .toList();
        return trips.stream().map(trip -> new FiguredTrip(trip, figuresCalculator.figures(trip, modes))).toList();
    }

    private static TripSearchCriteria criteria(TripSearchParams params) {
        if (params.from() != null && params.to() != null && params.from().isAfter(params.to())) {
            throw new FieldValidationException("to", "must not be before from");
        }
        return new TripSearchCriteria(
                params.q(),
                params.priority(),
                params.mode(),
                params.from(),
                params.to(),
                params.sort() == null ? TripSortKey.DATE : TripSortKey.valueOf(params.sort().toUpperCase(Locale.ROOT)),
                "desc".equals(params.direction()),
                params.page() == null ? 0 : params.page(),
                params.size() == null ? TripSearchParams.DEFAULT_SIZE : params.size());
    }

    private static Predicate<FiguredTrip> byPriority(List<TripPriority> priorities) {
        return item -> priorities.isEmpty() || priorities.contains(item.trip().getPriority());
    }

    /** A trip without figures matches no mode. */
    private static Predicate<FiguredTrip> byMode(List<TransportModeCode> modes) {
        return item -> modes.isEmpty()
                || item.figures().map(f -> f.modes().stream().anyMatch(modes::contains)).orElse(false);
    }

    /**
     * Date: by departure, then id. Cost and CO2: by that figure; trips without figures come last
     * in both directions; ties keep date-then-id order.
     */
    static Comparator<FiguredTrip> order(TripSortKey key, boolean descending) {
        Comparator<FiguredTrip> byDate = Comparator.comparing((FiguredTrip item) -> item.trip().getDepartureDate())
                .thenComparing(item -> item.trip().getId());
        if (key == TripSortKey.DATE) {
            return descending ? byDate.reversed() : byDate;
        }
        Function<TripFigures, BigDecimal> figure = key == TripSortKey.COST ? TripFigures::totalCost : TripFigures::co2Kg;
        Comparator<BigDecimal> values = descending ? Comparator.reverseOrder() : Comparator.naturalOrder();
        return Comparator.comparing((FiguredTrip item) -> item.figures().map(figure).orElse(null),
                        Comparator.nullsLast(values))
                .thenComparing(byDate);
    }

    private static List<PriorityCount> priorityCounts(List<FiguredTrip> trips) {
        return Arrays.stream(TripPriority.values())
                .map(priority -> new PriorityCount(priority,
                        trips.stream().filter(item -> item.trip().getPriority() == priority).count()))
                .toList();
    }

    private static List<ModeCount> modeCounts(List<FiguredTrip> trips) {
        return Arrays.stream(TransportModeCode.values())
                .map(mode -> new ModeCount(mode, trips.stream()
                        .filter(item -> item.figures().map(f -> f.modes().contains(mode)).orElse(false))
                        .count()))
                .toList();
    }

    private static List<PriorityTotalResponse> priorityTotals(List<FiguredTrip> trips) {
        return Arrays.stream(TripPriority.values())
                .map(priority -> {
                    List<FiguredTrip> inPriority = trips.stream()
                            .filter(item -> item.trip().getPriority() == priority)
                            .toList();
                    BigDecimal cost = inPriority.stream()
                            .map(item -> item.figures().map(TripFigures::totalCost).orElse(BigDecimal.ZERO))
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    return new PriorityTotalResponse(priority, inPriority.size(), cost);
                })
                .toList();
    }
}
