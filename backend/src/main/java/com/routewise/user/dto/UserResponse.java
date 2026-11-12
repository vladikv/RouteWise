package com.routewise.user.dto;

/** The logged-in account as the API returns it; never contains the password. */
public record UserResponse(Long id, String email, String displayName) {
}
