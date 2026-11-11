package com.routewise.common.exception;

import java.util.List;

import org.springframework.http.HttpStatus;

/**
 * A request that passed Bean Validation but breaks a business rule tied to
 * a specific field (e.g. an unknown city id). Rendered like a Bean Validation
 * failure: 400 with an {@code errors} list.
 */
public class FieldValidationException extends RouteWiseException {

    private final List<ValidationError> errors;

    public FieldValidationException(String field, String message) {
        super(HttpStatus.BAD_REQUEST, "%s %s".formatted(field, message));
        this.errors = List.of(new ValidationError(field, message));
    }

    public List<ValidationError> getErrors() {
        return errors;
    }
}
