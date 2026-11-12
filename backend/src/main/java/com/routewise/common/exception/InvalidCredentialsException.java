package com.routewise.common.exception;

import org.springframework.http.HttpStatus;

/**
 * A login with an unknown email or a wrong password. One message for both,
 * so the response does not reveal which emails have an account.
 */
public class InvalidCredentialsException extends RouteWiseException {

    public InvalidCredentialsException() {
        super(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }
}
