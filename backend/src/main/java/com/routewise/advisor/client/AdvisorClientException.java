package com.routewise.advisor.client;

/**
 * The LLM advisor could not produce a usable result. Never reaches the API
 * caller: {@code AdvisorService} falls back to the rule-based advisor.
 */
public class AdvisorClientException extends RuntimeException {

    public AdvisorClientException(String message) {
        super(message);
    }

    public AdvisorClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
