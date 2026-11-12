package com.routewise.advisor.service;

import static com.routewise.advisor.AdvisorTestData.TODAY;
import static com.routewise.advisor.AdvisorTestData.berlinToVienna;
import static com.routewise.advisor.AdvisorTestData.bikeUnavailable;
import static com.routewise.advisor.AdvisorTestData.comparison;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import com.routewise.advisor.client.AdvisorClient;
import com.routewise.advisor.client.AdvisorClientException;
import com.routewise.advisor.domain.AdviceContext;
import com.routewise.advisor.domain.AdviceText;
import com.routewise.advisor.domain.AdvisorSource;
import com.routewise.advisor.domain.TripExtraction;
import com.routewise.advisor.dto.AdviceResponse;
import com.routewise.advisor.dto.TripDraftResponse;
import com.routewise.city.dto.CityResponse;
import com.routewise.city.dto.CitySummary;
import com.routewise.city.service.CityService;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.comparison.service.ComparisonService;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.dto.TripResponse;
import com.routewise.trip.service.TripService;
import com.routewise.user.TestUsers;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Uses the real (pure) rule classes; only I/O collaborators are mocked.
 */
@ExtendWith(MockitoExtension.class)
class AdvisorServiceTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-11T10:00:00Z"), ZoneOffset.UTC);
    private static final CitySummary BERLIN = new CitySummary(1L, "Berlin", "DE");
    private static final CitySummary VIENNA = new CitySummary(2L, "Vienna", "AT");
    private static final String REQUEST = "Berlin to Vienna next Friday, 2 people, cheap";

    @Mock
    private AdvisorClient advisorClient;

    @Mock
    private CityService cityService;

    @Mock
    private TripService tripService;

    @Mock
    private ComparisonService comparisonService;

    @BeforeEach
    void setUp() {
        lenientCities();
    }

    @Test
    void parse_withoutAdvisorClient_usesRules() {
        TripDraftResponse draft = service(Optional.empty()).parse(REQUEST);

        assertThat(draft).isEqualTo(new TripDraftResponse("Berlin to Vienna", BERLIN, VIENNA,
                LocalDate.of(2026, 11, 13), 2, TripPriority.CHEAPEST, null, AdvisorSource.RULES, List.of()));
    }

    @Test
    void parse_withAdvisorClient_usesAiExtractionAndChecksIt() {
        when(advisorClient.extractTrip(REQUEST, List.of("Berlin", "Vienna"), TODAY)).thenReturn(
                new TripExtraction("Cheap trip to Vienna", "Berlin", "Oslo", LocalDate.of(2026, 11, 13), 2,
                        TripPriority.CHEAPEST, "Prefers mornings"));

        TripDraftResponse draft = service(Optional.of(advisorClient)).parse(REQUEST);

        assertThat(draft.source()).isEqualTo(AdvisorSource.AI);
        assertThat(draft.title()).isEqualTo("Cheap trip to Vienna");
        assertThat(draft.notes()).isEqualTo("Prefers mornings");
        assertThat(draft.destination()).isNull();
        assertThat(draft.warnings()).containsExactly("\"Oslo\" is not a supported destination city.");
    }

    @Test
    void parse_whenAdvisorClientFails_fallsBackToRules() {
        when(advisorClient.extractTrip(any(), any(), any())).thenThrow(new AdvisorClientException("timeout"));

        TripDraftResponse draft = service(Optional.of(advisorClient)).parse(REQUEST);

        assertThat(draft.source()).isEqualTo(AdvisorSource.RULES);
        assertThat(draft.origin()).isEqualTo(BERLIN);
        assertThat(draft.destination()).isEqualTo(VIENNA);
    }

    @Test
    void parse_whenAdvisorClientThrowsUnexpectedly_stillFallsBackToRules() {
        when(advisorClient.extractTrip(any(), any(), any())).thenThrow(new IllegalStateException("bug"));

        assertThat(service(Optional.of(advisorClient)).parse(REQUEST).source()).isEqualTo(AdvisorSource.RULES);
    }

    @Test
    void advise_withoutAdvisorClient_usesRulesAndEngineRecommendation() {
        stubTrip();

        AdviceResponse advice = service(Optional.empty()).advise(1L, TestUsers.ALICE_ID);

        assertThat(advice.tripId()).isEqualTo(1L);
        assertThat(advice.recommendedMode()).isEqualTo(TransportModeCode.TRAIN);
        assertThat(advice.source()).isEqualTo(AdvisorSource.RULES);
        assertThat(advice.summary()).startsWith("Take the train from Berlin to Vienna");
    }

    @Test
    void advise_withAdvisorClient_usesAiWordingButKeepsEngineRecommendation() {
        stubTrip();
        AdviceContext expectedContext = new AdviceContext("Berlin", "Vienna", berlinToVienna());
        when(advisorClient.writeAdvice(expectedContext))
                .thenReturn(new AdviceText("Take the train.", List.of("Pack an umbrella.")));

        AdviceResponse advice = service(Optional.of(advisorClient)).advise(1L, TestUsers.ALICE_ID);

        assertThat(advice).isEqualTo(new AdviceResponse(1L, TransportModeCode.TRAIN, "Take the train.",
                List.of("Pack an umbrella."), AdvisorSource.AI));
    }

    @Test
    void advise_whenAdvisorClientFails_fallsBackToRules() {
        stubTrip();
        when(advisorClient.writeAdvice(any())).thenThrow(new AdvisorClientException("refusal"));

        AdviceResponse advice = service(Optional.of(advisorClient)).advise(1L, TestUsers.ALICE_ID);

        assertThat(advice.source()).isEqualTo(AdvisorSource.RULES);
        assertThat(advice.recommendedMode()).isEqualTo(TransportModeCode.TRAIN);
    }

    @Test
    void advise_noModeAvailable_hasNoRecommendedMode() {
        when(tripService.findById(1L, TestUsers.ALICE_ID)).thenReturn(trip());
        when(comparisonService.compare(1L, TestUsers.ALICE_ID)).thenReturn(comparison(List.of(), bikeUnavailable()));

        AdviceResponse advice = service(Optional.empty()).advise(1L, TestUsers.ALICE_ID);

        assertThat(advice.recommendedMode()).isNull();
    }

    @Test
    void advise_unknownTrip_throwsNotFoundWithoutCallingTheClient() {
        when(tripService.findById(42L, TestUsers.ALICE_ID)).thenThrow(new ResourceNotFoundException("Trip", 42L));

        assertThatThrownBy(() -> service(Optional.of(advisorClient)).advise(42L, TestUsers.ALICE_ID))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(advisorClient, comparisonService);
    }

    private AdvisorService service(Optional<AdvisorClient> client) {
        return new AdvisorService(client, new RuleBasedTripParser(), new TripDraftResolver(),
                new RuleBasedAdviceWriter(), cityService, tripService, comparisonService, CLOCK);
    }

    private void lenientCities() {
        lenient().when(cityService.findAll(null)).thenReturn(List.of(
                new CityResponse(1L, "Berlin", "DE", 52.52, 13.405),
                new CityResponse(2L, "Vienna", "AT", 48.2082, 16.3738)));
    }

    private void stubTrip() {
        when(tripService.findById(1L, TestUsers.ALICE_ID)).thenReturn(trip());
        when(comparisonService.compare(1L, TestUsers.ALICE_ID)).thenReturn(berlinToVienna());
    }

    private static TripResponse trip() {
        return new TripResponse(1L, "Berlin to Vienna", BERLIN, VIENNA, LocalDate.of(2026, 11, 20), 2,
                TripPriority.GREENEST, null, Instant.EPOCH, Instant.EPOCH);
    }
}
