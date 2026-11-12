package com.routewise.advisor.service;

import static com.routewise.advisor.AdvisorTestData.DEPARTURE;
import static com.routewise.advisor.AdvisorTestData.berlinPragueVienna;
import static com.routewise.advisor.AdvisorTestData.berlinToVienna;
import static com.routewise.advisor.AdvisorTestData.bikeUnavailable;
import static com.routewise.advisor.AdvisorTestData.bus;
import static com.routewise.advisor.AdvisorTestData.comparison;
import static com.routewise.advisor.AdvisorTestData.train;
import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import com.routewise.advisor.domain.AdviceContext;
import com.routewise.advisor.domain.AdviceText;
import com.routewise.comparison.dto.ModeOptionResponse;
import com.routewise.comparison.dto.WeatherSummary;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.weather.domain.WeatherHazard;

import org.junit.jupiter.api.Test;

class RuleBasedAdviceWriterTest {

    private static final List<String> BERLIN_VIENNA = List.of("Berlin", "Vienna");

    private final RuleBasedAdviceWriter writer = new RuleBasedAdviceWriter();

    @Test
    void write_recommendationWithAlternativeAndWeather_explainsAll() {
        AdviceText advice = writer.write(new AdviceContext(BERLIN_VIENNA, berlinToVienna()));

        // Train: 373 min = 6 h 13 min. Bus vs train: 453 - 373 = 80 min = 1 h 20 min slower,
        // 90.80 - 150.80 = -60.00 EUR (cheaper), 54.0 - 44.0 = 10.0 kg more CO2.
        assertThat(advice.summary()).isEqualTo("Take the train from Berlin to Vienna: 6 h 13 min, 150.80 EUR "
                + "and 44.0 kg CO₂ for 2 travelers. It is the best match for your priority: low emissions.");
        assertThat(advice.tips()).containsExactly(
                "Alternative: bus, 1 h 20 min slower, 60.00 EUR cheaper and 10.0 kg more CO₂.",
                "Weather in Vienna on 2026-11-20: Rain, 4 to 9 °C, 90% chance of precipitation. Expect rain.");
        assertThat(advice.legs()).containsExactly(
                "Leg 1, Berlin to Vienna: train, 6 h 13 min, 150.80 EUR and 44.0 kg CO₂.");
    }

    @Test
    void write_twoLegs_explainsThePlanEachLegAndTheBestSingleModeAlternative() {
        AdviceText advice = writer.write(new AdviceContext(List.of("Berlin", "Prague", "Vienna"),
                berlinPragueVienna()));

        // Plan: 240 + 270 = 510 min = 8 h 30 min, 40.00 + 18.00 = 58.00 EUR, 10.0 + 7.0 = 17.0 kg.
        assertThat(advice.summary()).isEqualTo("Recommended plan for Berlin → Prague → Vienna: train, then bus. "
                + "In total 8 h 30 min, 58.00 EUR and 17.0 kg CO₂ for 2 travelers; each leg is the best match for "
                + "a balance of time, cost and CO₂.");
        assertThat(advice.legs()).containsExactly(
                "Leg 1, Berlin to Prague: train, 4 h, 40.00 EUR and 10.0 kg CO₂.",
                "Leg 2, Prague to Vienna: bus, 4 h 30 min, 18.00 EUR and 7.0 kg CO₂.");
        // BALANCED compares by time: train throughout 490 min beats bus 570. 490 - 510 = 20 min faster,
        // 85.00 - 58.00 = 27.00 EUR more, 19.0 - 17.0 = 2.0 kg more CO2.
        assertThat(advice.tips()).containsExactly(
                "Alternative: the train for every leg, 20 min faster, 27.00 EUR more expensive and 2.0 kg more CO₂.",
                "No weather forecast is available for the departure date, so the weather is not taken into account.");
    }

    @Test
    void modesPhrase_describesMixedAndSingleModePlans() {
        assertThat(RuleBasedAdviceWriter.modesPhrase(List.of(TransportModeCode.TRAIN, TransportModeCode.BUS,
                TransportModeCode.TRAIN))).isEqualTo("train, then bus, then train");
        assertThat(RuleBasedAdviceWriter.modesPhrase(List.of(TransportModeCode.BUS, TransportModeCode.BUS)))
                .isEqualTo("bus all the way");
    }

    @Test
    void write_recommendedModeHasEngineNotes_includesThemAfterTheAlternative() {
        ModeOptionResponse trainWithNote = new ModeOptionResponse(TransportModeCode.TRAIN, true, null,
                new BigDecimal("628.3"), 373, new BigDecimal("150.80"), new BigDecimal("44.0"), 87, true,
                List.of("Snow expected: allow extra time."));

        AdviceText advice = writer.write(new AdviceContext(BERLIN_VIENNA,
                comparison(List.of(), trainWithNote, bus())));

        assertThat(advice.tips()).containsExactly(
                "Alternative: bus, 1 h 20 min slower, 60.00 EUR cheaper and 10.0 kg more CO₂.",
                "Snow expected: allow extra time.",
                "No weather forecast is available for the departure date, so the weather is not taken into account.");
    }

    @Test
    void write_noModeAvailable_listsTheReasons() {
        AdviceText advice = writer.write(new AdviceContext(BERLIN_VIENNA,
                comparison(List.of(), bikeUnavailable())));

        assertThat(advice.summary()).isEqualTo("No transport mode is available from Berlin to Vienna.");
        assertThat(advice.legs()).containsExactly("Leg 1, Berlin to Vienna: no transport mode is available.");
        assertThat(advice.tips()).containsExactly("Route of 681 km exceeds the BIKE limit of 150 km");
    }

    @Test
    void write_onlyOneAvailableMode_hasNoAlternativeTip() {
        AdviceText advice = writer.write(new AdviceContext(BERLIN_VIENNA,
                comparison(List.of(), train(true), bikeUnavailable())));

        assertThat(advice.tips()).noneMatch(tip -> tip.startsWith("Alternative"));
    }

    @Test
    void compare_fasterAndPricierAlternative_describesTradeOff() {
        ModeOptionResponse plane = new ModeOptionResponse(TransportModeCode.PLANE, true, null,
                new BigDecimal("523.6"), 193, new BigDecimal("230.80"), new BigDecimal("44.0"), 60, false, List.of());

        // 193 - 373 = -180 min = 3 h faster; 230.80 - 150.80 = 80.00 EUR more; equal CO2.
        assertThat(RuleBasedAdviceWriter.compare(plane, train(true), "EUR"))
                .isEqualTo("Alternative: plane, 3 h faster, 80.00 EUR more expensive and same CO₂.");
    }

    @Test
    void weatherTip_missingValuesAndSeveralHazards_skipsMissingAndListsHazardsInOrder() {
        WeatherSummary summary = new WeatherSummary("Berlin", DEPARTURE, "Snow", null, null, null, 45.0,
                Set.of(WeatherHazard.STRONG_WIND, WeatherHazard.SNOW));

        assertThat(RuleBasedAdviceWriter.weatherTip(summary))
                .isEqualTo("Weather in Berlin on 2026-11-20: Snow. Expect snow, strong wind.");
    }

    @Test
    void duration_formatsHoursAndMinutes() {
        assertThat(RuleBasedAdviceWriter.duration(45)).isEqualTo("45 min");
        assertThat(RuleBasedAdviceWriter.duration(180)).isEqualTo("3 h");
        assertThat(RuleBasedAdviceWriter.duration(373)).isEqualTo("6 h 13 min");
    }
}
