package com.routewise.common.exception;

import java.util.List;

import org.springframework.http.HttpStatus;

/**
 * A request that passed Bean Validation but breaks a business rule tied to
 * a specific field (e.g. an unknown city id). Rendered like a Bean Validation
 * failure: 400 with an {@code errors} list. Subclasses may use another status
 * (see {@link DuplicateFieldException}) and keep the {@code errors} list.
 */
public class FieldValidationException extends RouteWiseException {

    private final List<ValidationError> errors;

    public FieldValidationException(String field, String message) {
        this(HttpStatus.BAD_REQUEST, field, message);
    }

    protected FieldValidationException(HttpStatus status, String field, String message) {
        super(status, "%s %s".formatted(field, message));
        this.errors = List.of(new ValidationError(field, message));
    }

    /** Several fields at once, e.g. two unknown cities in one stop list. */
    public FieldValidationException(List<ValidationError> errors) {
        super(HttpStatus.BAD_REQUEST, errors.stream()
                .map(error -> "%s %s".formatted(error.field(), error.message()))
                .reduce((a, b) -> a + "; " + b)
                .orElse("invalid request"));
        this.errors = List.copyOf(errors);
    }

    public List<ValidationError> getErrors() {
        return errors;
    }
}
