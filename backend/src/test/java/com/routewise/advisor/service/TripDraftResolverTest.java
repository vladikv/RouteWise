package com.routewise.advisor.service;

import static com.routewise.advisor.AdvisorTestData.TODAY;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.IntStream;

import com.routewise.advisor.domain.TripDraft;
import com.routewise.advisor.domain.TripExtraction;
import com.routewise.city.dto.CitySummary;
import com.routewise.trip.domain.TripPriority;

import org.junit.jupiter.api.Test;

class TripDraftResolverTest {

    private static final CitySummary BERLIN = new CitySummary(1L, "Berlin", "DE");
    private static final CitySummary VIENNA = new CitySummary(2L, "Vienna", "AT");
    private static final CitySummary PRAGUE = new CitySummary(3L, "Prague", "CZ");
    private static final List<CitySummary> CITIES = List.of(BERLIN, VIENNA, PRAGUE);
    private static final LocalDate FRIDAY = LocalDate.of(2026, 11, 13);

    private final TripDraftResolver resolver = new TripDraftResolver();

    @Test
    void resolve_completeExtraction_returnsDraftWithoutWarnings() {
        TripDraft draft = resolver.resolve(extraction(FRIDAY, 2, "berlin", "Vienna"), CITIES, TODAY);

        assertThat(draft).isEqualTo(new TripDraft("Berlin to Vienna", List.of(BERLIN, VIENNA), FRIDAY, 2,
                TripPriority.CHEAPEST, "Window seat", List.of()));
    }

    @Test
    void resolve_severalStops_keepsTheirOrderAndTitlesTheRoute() {
        TripDraft draft = resolver.resolve(extraction(FRIDAY, 2, "Berlin", "Prague", "Vienna"), CITIES, TODAY);

        assertThat(draft.stops()).containsExactly(BERLIN, PRAGUE, VIENNA);
        assertThat(draft.title()).isEqualTo("Berlin to Vienna via Prague");
        assertThat(draft.warnings()).isEmpty();
    }

    @Test
    void resolve_backToTheFirstStop_isARoundTrip() {
        TripDraft draft = resolver.resolve(extraction(FRIDAY, 1, "Berlin", "Prague", "Berlin"), CITIES, TODAY);

        assertThat(draft.stops()).containsExactly(BERLIN, PRAGUE, BERLIN);
        assertThat(draft.title()).isEqualTo("Round trip from Berlin");
    }

    @Test
    void resolve_emptyExtraction_appliesDefaultsAndWarns() {
        TripDraft draft = resolver.resolve(TripExtraction.empty(), CITIES, TODAY);

        assertThat(draft).isEqualTo(new TripDraft("New trip", Arrays.asList(null, null), null, 1,
                TripPriority.BALANCED, null, List.of("No cities recognised.", "No departure date recognised.")));
    }

    @Test
    void resolve_unsupportedCities_becomeEmptyStopsWithAWarningEach() {
        TripDraft draft = resolver.resolve(extraction(FRIDAY, 1, "Rzeszów", "Berlin", "Zakopane", "Rzeszów"),
                CITIES, TODAY);

        assertThat(draft.stops()).containsExactly(null, BERLIN, null, null);
        assertThat(draft.warnings()).containsExactly(
                "\"Rzeszów\" is not a supported city; please choose a stop.",
                "\"Zakopane\" is not a supported city; please choose a stop.",
                "\"Rzeszów\" is not a supported city; please choose a stop.");
        assertThat(draft.title()).isEqualTo("New trip");
    }

    @Test
    void resolve_sameCityTwiceInARow_keepsItOnce() {
        TripDraft draft = resolver.resolve(extraction(FRIDAY, 1, "Berlin", "Berlin", "Vienna"), CITIES, TODAY);

        assertThat(draft.stops()).containsExactly(BERLIN, VIENNA);
        assertThat(draft.warnings()).containsExactly("Berlin appears twice in a row; it is kept once.");
    }

    @Test
    void resolve_oneStop_isPaddedToTwoWithAWarning() {
        TripDraft draft = resolver.resolve(extraction(FRIDAY, 1, "Vienna"), CITIES, TODAY);

        assertThat(draft.stops()).containsExactly(VIENNA, null);
        assertThat(draft.warnings()).containsExactly("Fewer than two stops recognised.");
        assertThat(draft.title()).isEqualTo("New trip");
    }

    @Test
    void resolve_moreThanTenStops_keepsTheFirstTen() {
        String[] names = IntStream.range(0, 12).mapToObj(i -> i % 2 == 0 ? "Berlin" : "Vienna")
                .toArray(String[]::new);

        TripDraft draft = resolver.resolve(extraction(FRIDAY, 1, names), CITIES, TODAY);

        assertThat(draft.stops()).hasSize(10);
        assertThat(draft.warnings()).containsExactly("A trip has at most 10 stops; the rest were left out.");
    }

    @Test
    void resolve_laterDates_warnsThatOnlyTheDepartureIsUsed() {
        TripDraft draft = resolver.resolve(new TripExtraction(null, List.of("Berlin", "Vienna", "Berlin"), FRIDAY,
                true, 1, null, null), CITIES, TODAY);

        assertThat(draft.departureDate()).isEqualTo(FRIDAY);
        assertThat(draft.warnings()).containsExactly("Only the departure date is used; later dates in the request "
                + "(such as a return day) are not stored.");
    }

    @Test
    void resolve_pastDate_dropsItWithWarning() {
        TripDraft draft = resolver.resolve(extraction(LocalDate.of(2026, 11, 10), 1, "Berlin", "Vienna"), CITIES,
                TODAY);

        assertThat(draft.departureDate()).isNull();
        assertThat(draft.warnings()).containsExactly("Departure date 2026-11-10 is in the past.");
    }

    @Test
    void resolve_todayAsDate_isKept() {
        TripDraft draft = resolver.resolve(extraction(TODAY, 1, "Berlin", "Vienna"), CITIES, TODAY);

        assertThat(draft.departureDate()).isEqualTo(TODAY);
    }

    @Test
    void resolve_travelersOutOfRange_defaultsToOneWithWarning() {
        TripDraft draft = resolver.resolve(extraction(FRIDAY, 12, "Berlin", "Vienna"), CITIES, TODAY);

        assertThat(draft.travelers()).isEqualTo(1);
        assertThat(draft.warnings()).containsExactly("Travelers must be between 1 and 9; the request mentions 12.");
    }

    @Test
    void resolve_longTitleAndNotes_areTruncatedToTripLimits() {
        TripDraft draft = resolver.resolve(new TripExtraction("t".repeat(150), List.of("Berlin", "Vienna"), FRIDAY,
                false, 1, null, "n".repeat(1200)), CITIES, TODAY);

        assertThat(draft.title()).hasSize(100);
        assertThat(draft.notes()).hasSize(1000);
    }

    @Test
    void title_withUnknownMiddleStop_namesOnlyTheKnownOnes() {
        assertThat(TripDraftResolver.title(null, Arrays.asList(BERLIN, null, VIENNA)))
                .isEqualTo("Berlin to Vienna");
        assertThat(TripDraftResolver.title(null, Collections.nCopies(2, null))).isEqualTo("New trip");
    }

    private static TripExtraction extraction(LocalDate date, int travelers, String... stops) {
        return new TripExtraction(null, List.of(stops), date, false, travelers, TripPriority.CHEAPEST, "Window seat");
    }
}
