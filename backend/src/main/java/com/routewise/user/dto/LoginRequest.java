package com.routewise.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/auth/login}. */
public record LoginRequest(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 72) String password) {

    /** Keeps the password out of logs and error output. */
    @Override
    public String toString() {
        return "LoginRequest[email=%s]".formatted(email);
    }
}
