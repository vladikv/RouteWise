package com.routewise.common.exception;

/**
 * A single validation failure, exposed in the {@code errors} property of a 400 Problem Details response.
 */
public record ValidationError(String field, String message) {
}
