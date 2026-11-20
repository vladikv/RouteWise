package com.routewise.flightprice.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Duration;

import org.junit.jupiter.api.Test;

class FlightPricePropertiesTest {

    @Test
    void toString_neverShowsTheKey() {
        FlightPriceProperties properties = properties("secret-key");

        assertThat(properties.toString()).doesNotContain("secret-key").contains("apiKey=<set>");
    }

    @Test
    void toString_withoutKey_saysSo() {
        assertThat(properties("").toString()).contains("apiKey=<none>");
        assertThat(properties(null).toString()).contains("apiKey=<none>");
    }

    private static FlightPriceProperties properties(String apiKey) {
        return new FlightPriceProperties(apiKey, URI.create("https://serpapi.com"), Duration.ofSeconds(2),
                Duration.ofSeconds(10), Duration.ofHours(6));
    }
}
