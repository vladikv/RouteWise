package com.routewise.advisor.service;

import static com.routewise.advisor.AdvisorTestData.TODAY;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;

import com.routewise.advisor.domain.TripExtraction;
import com.routewise.trip.domain.TripPriority;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * Reference date: Wednesday 2026-11-11.
 */
class RuleBasedTripParserTest {

    /** The 25 seeded cities (V2 migration). */
    private static final List<String> CITIES = List.of("Amsterdam", "Barcelona", "Berlin", "Brussels", "Budapest",
            "Cologne", "Copenhagen", "Frankfurt", "Hamburg", "Krakow", "Lisbon", "Ljubljana", "London", "Lyon",
            "Madrid", "Milan", "Munich", "Paris", "Prague", "Rome", "Stockholm", "Venice", "Vienna", "Warsaw",
            "Zurich");

    private final RuleBasedTripParser parser = new RuleBasedTripParser();

    @Test
    void parse_fullRequest_extractsAllFields() {
        TripExtraction result = parser.parse("Berlin to Vienna next Friday, 2 people, as cheap as possible",
                CITIES, TODAY);

        assertThat(result).isEqualTo(new TripExtraction(null, List.of("Berlin", "Vienna"),
                LocalDate.of(2026, 11, 13), false, 2, TripPriority.CHEAPEST, null));
    }

    @Test
    void parse_destinationMentionedFirst_putsTheFromCityFirst() {
        TripExtraction result = parser.parse("I want to go to Vienna from Berlin", CITIES, TODAY);

        assertThat(result.stops()).containsExactly("Berlin", "Vienna");
    }

    @Test
    void parse_severalStops_keepsTheOrderOfMention() {
        TripExtraction result = parser.parse("Berlin to Prague, then Vienna via Budapest", CITIES, TODAY);

        assertThat(result.stops()).containsExactly("Berlin", "Prague", "Vienna", "Budapest");
    }

    @Test
    void parse_backHome_returnsToTheFirstStopAndTreatsItsDateAsALaterDate() {
        TripExtraction result = parser.parse("Rzeszów to Kraków, then Zakopane, back home Sunday", CITIES, TODAY);

        assertThat(result.stops()).containsExactly("Rzeszów", "Krakow", "Zakopane", "Rzeszów");
        assertThat(result.departureDate()).isNull();
        assertThat(result.laterDates()).isTrue();
    }

    @Test
    void parse_departureAndReturnDates_keepsTheDepartureOnly() {
        TripExtraction result = parser.parse("Berlin to Vienna on friday and back on sunday", CITIES, TODAY);

        assertThat(result.stops()).containsExactly("Berlin", "Vienna", "Berlin");
        assertThat(result.departureDate()).isEqualTo(LocalDate.of(2026, 11, 13));
        assertThat(result.laterDates()).isTrue();
    }

    @Test
    void parse_localSpellingsAndDiacritics_mapToSeededCities() {
        assertThat(parser.parse("Wien - München", CITIES, TODAY).stops()).containsExactly("Vienna", "Munich");
        assertThat(parser.parse("ZÜRICH to Kraków", CITIES, TODAY).stops()).containsExactly("Zurich", "Krakow");
    }

    @Test
    void parse_unsupportedCity_isKeptAsWrittenForTheResolverToReport() {
        TripExtraction result = parser.parse("Oslo to Berlin", CITIES, TODAY);

        assertThat(result.stops()).containsExactly("Oslo", "Berlin");
    }

    @Test
    void parse_capitalisedWordsThatAreNotPlaces_areIgnored() {
        TripExtraction result = parser.parse("Berlin to Vienna next Friday, then Monday to Prague", CITIES, TODAY);

        assertThat(result.stops()).containsExactly("Berlin", "Vienna", "Prague");
    }

    @Test
    void parse_cityNameInsideAnotherWord_isNotMatched() {
        TripExtraction result = parser.parse("A Romeo and Juliet tour after breakfast", CITIES, TODAY);

        assertThat(result).isEqualTo(TripExtraction.empty());
    }

    @Test
    void parse_sameCityTwiceInARow_isLeftForTheResolver() {
        TripExtraction result = parser.parse("Paris, Paris and Lyon", CITIES, TODAY);

        assertThat(result.stops()).containsExactly("Paris", "Paris", "Lyon");
    }

    @ParameterizedTest(name = "\"{0}\" -> {1}")
    @CsvSource({
            "leaving 2026-12-24, 2026-12-24",
            "leaving 24.12.2026, 2026-12-24",
            "on 20 november, 2026-11-20",
            "on the 3rd of december, 2026-12-03",
            "march 15th, 2027-03-15",       // already passed this year -> next year
            "15 march 2028, 2028-03-15",
            "today, 2026-11-11",
            "tomorrow, 2026-11-12",
            "the day after tomorrow, 2026-11-13",
            "in 3 days, 2026-11-14",
            "in two weeks, 2026-11-25",
            "in a week, 2026-11-18",
            "next week, 2026-11-18",
            "on friday, 2026-11-13",
            "next wednesday, 2026-11-18",    // the weekday after today, never today itself
            "friday next week, 2026-11-20",  // Friday of the calendar week after this one
            "monday next week, 2026-11-16"
    })
    void findDate_recognisedExpressions_resolveAgainstToday(String text, LocalDate expected) {
        assertThat(RuleBasedTripParser.findDate(text, TODAY)).contains(expected);
    }

    @Test
    void findDate_impossibleOrMissingDate_isEmpty() {
        assertThat(RuleBasedTripParser.findDate("on 2026-02-30", TODAY)).isEmpty();
        assertThat(RuleBasedTripParser.findDate("some time soon", TODAY)).isEmpty();
        assertThat(RuleBasedTripParser.findDate("we may 3 people go", TODAY)).isEmpty(); // "may" the verb
    }

    @ParameterizedTest(name = "\"{0}\" -> {1}")
    @CsvSource({
            "2 people, 2",
            "three adults, 3",
            "a family of four, 4",
            "with 2 friends, 3",
            "me and 2 friends, 3",
            "2 adults and 2 kids, 4",
            "with my wife, 2",
            "travelling alone, 1",
            "12 passengers, 12"           // out of range is reported by the resolver, not here
    })
    void findTravelers_recognisedExpressions_countTheRequester(String text, int expected) {
        assertThat(RuleBasedTripParser.findTravelers(text)).contains(expected);
    }

    @Test
    void findTravelers_noMention_isEmpty() {
        assertThat(RuleBasedTripParser.findTravelers("berlin to vienna")).isEmpty();
    }

    @ParameterizedTest(name = "\"{0}\" -> {1}")
    @CsvSource({
            "as fast as possible, FASTEST",
            "on a budget, CHEAPEST",
            "eco-friendly please, GREENEST",
            "low co2, GREENEST",
            "cheap but fast, BALANCED",
            "something balanced, BALANCED"
    })
    void findPriority_keywords_mapToPriority(String text, TripPriority expected) {
        assertThat(RuleBasedTripParser.findPriority(text)).contains(expected);
    }

    @Test
    void findPriority_noKeyword_isEmpty() {
        assertThat(RuleBasedTripParser.findPriority("after breakfast")).isEmpty();
    }
}
