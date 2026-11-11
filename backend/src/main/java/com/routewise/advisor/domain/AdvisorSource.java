package com.routewise.advisor.domain;

/**
 * Who produced an advisor result: the configured LLM, or the built-in rules
 * (no API key configured, or the LLM call failed).
 */
public enum AdvisorSource {
    AI, RULES
}
