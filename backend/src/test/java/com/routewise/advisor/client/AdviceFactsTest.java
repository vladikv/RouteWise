package com.routewise.advisor.client;

import static com.routewise.advisor.AdvisorTestData.berlinToVienna;
import static com.routewise.advisor.AdvisorTestData.comparison;
import static com.routewise.advisor.AdvisorTestData.train;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import com.routewise.advisor.domain.AdviceContext;

import org.junit.jupiter.api.Test;

class AdviceFactsTest {

    @Test
    void describe_fullComparison_listsTripModesAndWeather() {
        String facts = AdviceFacts.describe(new AdviceContext("Berlin", "Vienna", berlinToVienna()));

        assertThat(facts).isEqualTo("""
                Trip: Berlin to Vienna on 2026-11-20, 2 traveler(s), priority GREENEST.
                Straight-line distance: 523.6 km. Costs (EUR) and CO2 are totals for all travelers.
                Modes, best first (score 0-100, weather already taken into account):
                - TRAIN (recommended): 373 min, 150.80 EUR, 44.0 kg CO2, score 87
                - BUS: 453 min, 90.80 EUR, 54.0 kg CO2, score 71
                - BIKE: unavailable (Route of 681 km exceeds the BIKE limit of 150 km)
                Weather:
                - Vienna on 2026-11-20: Rain, 4.0 to 9.0 °C, precipitation 90%, wind up to 20.0 km/h, hazards: rain""");
    }

    @Test
    void describe_noForecast_saysSo() {
        String facts = AdviceFacts.describe(new AdviceContext("Berlin", "Vienna", comparison(List.of(), train(true))));

        assertThat(facts).endsWith("Weather: no forecast available for the departure date.");
    }
}
