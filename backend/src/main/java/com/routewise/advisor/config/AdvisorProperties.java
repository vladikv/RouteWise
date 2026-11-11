package com.routewise.advisor.config;

import java.net.URI;
import java.time.Duration;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * LLM advisor settings, bound from {@code routewise.advisor.*}. Without an
 * API key the advisor runs on rules only.
 *
 * @param apiKey     Anthropic API key (env {@code ANTHROPIC_API_KEY}); blank disables the LLM
 * @param effort     Claude effort level: low, medium, high, xhigh or max
 * @param timeout    per attempt; the advisor waits at most {@code timeout × (maxRetries + 1)}
 */
@ConfigurationProperties("routewise.advisor")
@Validated
public record AdvisorProperties(
        String apiKey,
        @DefaultValue("https://api.anthropic.com") @NotNull URI baseUrl,
        @DefaultValue("claude-opus-5-5") @NotBlank String model,
        @DefaultValue("low") @Pattern(regexp = "low|medium|high|xhigh|max") String effort,
        @DefaultValue("16000") @Positive long maxTokens,
        @DefaultValue("20s") @NotNull Duration timeout,
        @DefaultValue("1") @PositiveOrZero int maxRetries) {

    /** Keeps the API key out of logs and actuator-style dumps. */
    @Override
    public String toString() {
        return "AdvisorProperties[apiKey=%s, baseUrl=%s, model=%s, effort=%s, maxTokens=%d, timeout=%s, maxRetries=%d]"
                .formatted(apiKey == null || apiKey.isBlank() ? "<none>" : "<set>", baseUrl, model, effort,
                        maxTokens, timeout, maxRetries);
    }
}
