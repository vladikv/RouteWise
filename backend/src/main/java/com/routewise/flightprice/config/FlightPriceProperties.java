package com.routewise.flightprice.config;

import java.net.URI;
import java.time.Duration;

import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Live flight price settings, bound from {@code routewise.flight-prices.*}. Without an API key
 * no client exists and every plane cost stays the regional estimate.
 *
 * @param apiKey      SerpApi key (env {@code ROUTEWISE_FLIGHT_PRICES_API_KEY}); blank = live prices off
 * @param readTimeout a Google Flights search takes a few seconds, so this is longer than the weather's
 * @param cacheTtl    how long a fare (or "no flight that day") is reused for the same airports and date
 */
@ConfigurationProperties("routewise.flight-prices")
@Validated
public record FlightPriceProperties(
        String apiKey,
        @DefaultValue("https://serpapi.com") @NotNull URI baseUrl,
        @DefaultValue("2s") Duration connectTimeout,
        @DefaultValue("10s") Duration readTimeout,
        @DefaultValue("6h") @NotNull Duration cacheTtl) {

    /** Never prints the key itself. */
    @Override
    public String toString() {
        return "FlightPriceProperties[apiKey=%s, baseUrl=%s, connectTimeout=%s, readTimeout=%s, cacheTtl=%s]"
                .formatted(apiKey == null || apiKey.isBlank() ? "<none>" : "<set>", baseUrl, connectTimeout,
                        readTimeout, cacheTtl);
    }
}
