package com.routewise.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/auth/register}. The password limit of 72 characters
 * is BCrypt's: longer input would be silently truncated.
 */
public record RegisterRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @Size(max = 50) String displayName) {

    /** Keeps the password out of logs and error output. */
    @Override
    public String toString() {
        return "RegisterRequest[email=%s, displayName=%s]".formatted(email, displayName);
    }
}
