package com.routewise.advisor.client;

import static com.routewise.advisor.AdvisorTestData.berlinPragueVienna;
import static com.routewise.advisor.AdvisorTestData.berlinToVienna;
import static com.routewise.advisor.AdvisorTestData.bikeUnavailable;
import static com.routewise.advisor.AdvisorTestData.comparison;
import static com.routewise.advisor.AdvisorTestData.train;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import com.routewise.advisor.domain.AdviceContext;

import org.junit.jupiter.api.Test;

class AdviceFactsTest {

    private static final List<String> BERLIN_VIENNA = List.of("Berlin", "Vienna");

    @Test
    void describe_oneLeg_listsRouteModesPlanAlternativesAndWeather() {
        String facts = AdviceFacts.describe(new AdviceContext(BERLIN_VIENNA, berlinToVienna()));

        assertThat(facts).isEqualTo("""
                Route: Berlin → Vienna on 2026-11-20, 2 traveler(s), priority GREENEST, 1 leg(s).
                Straight-line distance: 523.6 km in total. Costs (EUR) and CO2 are totals for all travelers.
                Leg 1: Berlin to Vienna, 523.6 km straight-line. Modes, best first (score 0-100, weather already \
                taken into account):
                - TRAIN (recommended): 373 min, 150.80 EUR, 44.0 kg CO2, score 87
                - BUS: 453 min, 90.80 EUR, 54.0 kg CO2, score 71
                - BIKE: unavailable (Route of 681 km exceeds the BIKE limit of 150 km)
                Recommended plan (each leg's recommended mode): TRAIN; total 373 min, 150.80 EUR, 44.0 kg CO2.
                Single-mode alternatives:
                - TRAIN for every leg: 373 min, 150.80 EUR, 44.0 kg CO2
                - BUS for every leg: 453 min, 90.80 EUR, 54.0 kg CO2
                - BIKE for every leg: not possible (Leg 1 (Berlin to Vienna): Route of 681 km exceeds the BIKE \
                limit of 150 km)
                Weather:
                - Vienna on 2026-11-20: Rain, 4.0 to 9.0 °C, precipitation 90%, wind up to 20.0 km/h, hazards: rain""");
    }

    @Test
    void describe_twoLegs_describesEachLegAndTheMixedPlan() {
        String facts = AdviceFacts.describe(new AdviceContext(List.of("Berlin", "Prague", "Vienna"),
                berlinPragueVienna()));

        assertThat(facts)
                .startsWith("Route: Berlin → Prague → Vienna on 2026-11-20, 2 traveler(s), priority BALANCED, 2 leg(s).")
                .contains("Leg 1: Berlin to Prague, 280.0 km straight-line.")
                .contains("Leg 2: Prague to Vienna, 252.0 km straight-line.")
                .contains("Recommended plan (each leg's recommended mode): TRAIN, then BUS; total 510 min, "
                        + "58.00 EUR, 17.0 kg CO2.")
                .contains("- BUS for every leg: 570 min, 38.00 EUR, 15.0 kg CO2");
    }

    @Test
    void describe_legWithoutAnyMode_saysThereIsNoPlan() {
        String facts = AdviceFacts.describe(new AdviceContext(BERLIN_VIENNA, comparison(List.of(), bikeUnavailable())));

        assertThat(facts).contains("Recommended plan: none, because at least one leg has no available mode.");
    }

    @Test
    void describe_noForecast_saysSo() {
        String facts = AdviceFacts.describe(new AdviceContext(BERLIN_VIENNA, comparison(List.of(), train(true))));

        assertThat(facts).endsWith("Weather: no forecast available for the departure date.");
    }
}
