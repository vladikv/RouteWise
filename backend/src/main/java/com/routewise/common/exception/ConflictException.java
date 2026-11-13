package com.routewise.common.exception;

import org.springframework.http.HttpStatus;

/**
 * The request is valid but the resource's current state does not allow it
 * (e.g. restoring a trip after the restore window): 409 Conflict.
 */
public class ConflictException extends RouteWiseException {

    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, message);
    }
}
