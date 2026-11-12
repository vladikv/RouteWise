package com.routewise.common.exception;

import org.springframework.http.HttpStatus;

/**
 * A unique value that is already taken (e.g. a registered email): 409 Conflict,
 * with the same {@code errors} entry as a validation failure so clients can show
 * it on the field.
 */
public class DuplicateFieldException extends FieldValidationException {

    public DuplicateFieldException(String field, String message) {
        super(HttpStatus.CONFLICT, field, message);
    }
}
