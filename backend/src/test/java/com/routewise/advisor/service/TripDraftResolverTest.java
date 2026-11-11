package com.routewise.advisor.service;

import static com.routewise.advisor.AdvisorTestData.TODAY;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;

import com.routewise.advisor.domain.TripDraft;
import com.routewise.advisor.domain.TripExtraction;
import com.routewise.city.dto.CitySummary;
import com.routewise.trip.domain.TripPriority;

import org.junit.jupiter.api.Test;

class TripDraftResolverTest {

    private static final CitySummary BERLIN = new CitySummary(1L, "Berlin", "DE");
    private static final CitySummary VIENNA = new CitySummary(2L, "Vienna", "AT");
    private static final List<CitySummary> CITIES = List.of(BERLIN, VIENNA);
    private static final LocalDate FRIDAY = LocalDate.of(2026, 11, 13);

    private final TripDraftResolver resolver = new TripDraftResolver();

    @Test
    void resolve_completeExtraction_returnsDraftWithoutWarnings() {
        TripDraft draft = resolver.resolve(new TripExtraction(null, "berlin", "Vienna", FRIDAY, 2,
                TripPriority.CHEAPEST, "Window seat"), CITIES, TODAY);

        assertThat(draft).isEqualTo(new TripDraft("Berlin to Vienna", BERLIN, VIENNA, FRIDAY, 2,
                TripPriority.CHEAPEST, "Window seat", List.of()));
    }

    @Test
    void resolve_emptyExtraction_appliesDefaultsAndWarns() {
        TripDraft draft = resolver.resolve(TripExtraction.empty(), CITIES, TODAY);

        assertThat(draft).isEqualTo(new TripDraft("New trip", null, null, null, 1, TripPriority.BALANCED, null,
                List.of("No origin city recognised.", "No destination city recognised.",
                        "No departure date recognised.")));
    }

    @Test
    void resolve_unsupportedCity_dropsItWithWarning() {
        TripDraft draft = resolver.resolve(new TripExtraction(null, "Oslo", "Vienna", FRIDAY, 1, null, null),
                CITIES, TODAY);

        assertThat(draft.origin()).isNull();
        assertThat(draft.title()).isEqualTo("Trip to Vienna");
        assertThat(draft.warnings()).containsExactly("\"Oslo\" is not a supported origin city.");
    }

    @Test
    void resolve_sameOriginAndDestination_dropsDestination() {
        TripDraft draft = resolver.resolve(new TripExtraction(null, "Berlin", "Berlin", FRIDAY, 1, null, null),
                CITIES, TODAY);

        assertThat(draft.origin()).isEqualTo(BERLIN);
        assertThat(draft.destination()).isNull();
        assertThat(draft.warnings())
                .containsExactly("Origin and destination are the same city; please choose a different destination.");
    }

    @Test
    void resolve_pastDate_dropsItWithWarning() {
        TripDraft draft = resolver.resolve(new TripExtraction(null, "Berlin", "Vienna",
                LocalDate.of(2026, 11, 10), 1, null, null), CITIES, TODAY);

        assertThat(draft.departureDate()).isNull();
        assertThat(draft.warnings()).containsExactly("Departure date 2026-11-10 is in the past.");
    }

    @Test
    void resolve_todayAsDate_isKept() {
        TripDraft draft = resolver.resolve(new TripExtraction(null, "Berlin", "Vienna", TODAY, 1, null, null),
                CITIES, TODAY);

        assertThat(draft.departureDate()).isEqualTo(TODAY);
    }

    @Test
    void resolve_travelersOutOfRange_defaultsToOneWithWarning() {
        TripDraft draft = resolver.resolve(new TripExtraction(null, "Berlin", "Vienna", FRIDAY, 12, null, null),
                CITIES, TODAY);

        assertThat(draft.travelers()).isEqualTo(1);
        assertThat(draft.warnings()).containsExactly("Travelers must be between 1 and 9; the request mentions 12.");
    }

    @Test
    void resolve_longTitleAndNotes_areTruncatedToTripLimits() {
        TripDraft draft = resolver.resolve(new TripExtraction("t".repeat(150), "Berlin", "Vienna", FRIDAY, 1,
                null, "n".repeat(1200)), CITIES, TODAY);

        assertThat(draft.title()).hasSize(100);
        assertThat(draft.notes()).hasSize(1000);
    }
}
