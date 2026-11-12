package com.routewise.advisor.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

import com.routewise.advisor.client.AdvisorClient;
import com.routewise.advisor.client.AdvisorClientException;
import com.routewise.advisor.domain.AdviceContext;
import com.routewise.advisor.domain.AdviceText;
import com.routewise.advisor.domain.AdvisorSource;
import com.routewise.advisor.domain.TripDraft;
import com.routewise.advisor.domain.TripExtraction;
import com.routewise.advisor.dto.AdviceResponse;
import com.routewise.advisor.dto.TripDraftResponse;
import com.routewise.city.dto.CitySummary;
import com.routewise.city.service.CityService;
import com.routewise.comparison.dto.ComparisonResponse;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.service.ComparisonService;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.dto.TripResponse;
import com.routewise.trip.service.TripService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * AI travel advisor with a rule-based fallback. Uses the {@link AdvisorClient}
 * when one is configured; without one, or when it fails, the rules answer, so
 * the endpoints always work. Not transactional: no transaction stays open
 * during LLM or weather calls.
 */
@Service
public class AdvisorService {

    private static final Logger log = LoggerFactory.getLogger(AdvisorService.class);

    private final Optional<AdvisorClient> advisorClient;
    private final RuleBasedTripParser tripParser;
    private final TripDraftResolver draftResolver;
    private final RuleBasedAdviceWriter adviceWriter;
    private final CityService cityService;
    private final TripService tripService;
    private final ComparisonService comparisonService;
    private final Clock clock;

    public AdvisorService(Optional<AdvisorClient> advisorClient, RuleBasedTripParser tripParser,
                          TripDraftResolver draftResolver, RuleBasedAdviceWriter adviceWriter,
                          CityService cityService, TripService tripService, ComparisonService comparisonService,
                          Clock clock) {
        this.advisorClient = advisorClient;
        this.tripParser = tripParser;
        this.draftResolver = draftResolver;
        this.adviceWriter = adviceWriter;
        this.cityService = cityService;
        this.tripService = tripService;
        this.comparisonService = comparisonService;
        this.clock = clock;
    }

    /**
     * Turns a free-text trip request into a checked draft. Nothing is stored.
     */
    public TripDraftResponse parse(String text) {
        List<CitySummary> cities = cityService.findAll(null).stream()
                .map(city -> new CitySummary(city.id(), city.name(), city.country()))
                .toList();
        List<String> cityNames = cities.stream().map(CitySummary::name).toList();
        LocalDate today = LocalDate.now(clock);

        Optional<TripExtraction> aiExtraction = tryAdvisorClient(
                client -> client.extractTrip(text, cityNames, today), "trip parsing");
        TripExtraction extraction = aiExtraction.orElseGet(() -> tripParser.parse(text, cityNames, today));
        TripDraft draft = draftResolver.resolve(extraction, cities, today);
        return toResponse(draft, aiExtraction.isPresent() ? AdvisorSource.AI : AdvisorSource.RULES);
    }

    /**
     * Explains the weather-aware comparison of a stored trip.
     *
     * @throws com.routewise.common.exception.ResourceNotFoundException if the trip does not exist
     */
    public AdviceResponse advise(Long tripId, Long ownerId) {
        TripResponse trip = tripService.findById(tripId, ownerId);
        ComparisonResponse comparison = comparisonService.compare(tripId, ownerId);
        AdviceContext context = new AdviceContext(trip.origin().name(), trip.destination().name(), comparison);

        Optional<AdviceText> aiAdvice = tryAdvisorClient(client -> client.writeAdvice(context), "advice");
        AdviceText advice = aiAdvice.orElseGet(() -> adviceWriter.write(context));
        TransportModeCode recommendedMode = comparison.options().stream()
                .filter(ModeOptionResponse::recommended)
                .map(ModeOptionResponse::mode)
                .findFirst()
                .orElse(null);
        return new AdviceResponse(tripId, recommendedMode, advice.summary(), advice.tips(),
                aiAdvice.isPresent() ? AdvisorSource.AI : AdvisorSource.RULES);
    }

    /** Empty when no client is configured or the call fails; never throws. */
    private <T> Optional<T> tryAdvisorClient(Function<AdvisorClient, T> call, String purpose) {
        if (advisorClient.isEmpty()) {
            return Optional.empty();
        }
        try {
            return Optional.of(call.apply(advisorClient.get()));
        } catch (AdvisorClientException ex) {
            log.warn("AI advisor unavailable for {}, using rules: {}", purpose, ex.getMessage());
        } catch (RuntimeException ex) {
            log.warn("AI advisor failed unexpectedly for {}, using rules", purpose, ex);
        }
        return Optional.empty();
    }

    private static TripDraftResponse toResponse(TripDraft draft, AdvisorSource source) {
        return new TripDraftResponse(draft.title(), draft.origin(), draft.destination(), draft.departureDate(),
                draft.travelers(), draft.priority(), draft.notes(), source, draft.warnings());
    }
}
