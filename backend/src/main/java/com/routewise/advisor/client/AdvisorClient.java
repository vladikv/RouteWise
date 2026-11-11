package com.routewise.advisor.client;

import java.time.LocalDate;
import java.util.List;

import com.routewise.advisor.domain.AdviceContext;
import com.routewise.advisor.domain.AdviceText;
import com.routewise.advisor.domain.TripExtraction;

/**
 * An LLM-backed travel advisor. Optional: the bean exists only when an API key
 * is configured. Implementations throw {@link AdvisorClientException} on any
 * failure (network, timeout, refusal, unusable output); callers fall back to rules.
 */
public interface AdvisorClient {

    /**
     * Reads trip fields from a free-text request.
     *
     * @param cityNames the supported city names, so the model can map spellings to them
     * @param today     reference date for relative dates such as "next Friday"
     */
    TripExtraction extractTrip(String text, List<String> cityNames, LocalDate today);

    /**
     * Explains the comparison's recommendation. The recommendation itself is not
     * changed; the model only words it.
     */
    AdviceText writeAdvice(AdviceContext context);
}
