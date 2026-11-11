package com.routewise.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Base class for domain exceptions. Each subclass defines the HTTP status
 * that {@link GlobalExceptionHandler} uses for the Problem Details response.
 */
public abstract class RouteWiseException extends RuntimeException {

    private final HttpStatus status;

    protected RouteWiseException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
