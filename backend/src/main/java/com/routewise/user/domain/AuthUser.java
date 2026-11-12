package com.routewise.user.domain;

import java.util.Collection;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * The logged-in user as Spring Security sees it, and as controllers receive it
 * through {@code @AuthenticationPrincipal}. Kept in the HTTP session, so it holds
 * only what is needed: no entity, and the password hash only until login.
 */
public record AuthUser(Long id, String email, String displayName, String passwordHash)
        implements UserDetails {

    private static final List<GrantedAuthority> AUTHORITIES = List.of(new SimpleGrantedAuthority("ROLE_USER"));

    public static AuthUser of(AppUser user) {
        return new AuthUser(user.getId(), user.getEmail(), user.getDisplayName(), user.getPasswordHash());
    }

    /** The same user without the password hash, for storing in the session. */
    public AuthUser withoutPassword() {
        return new AuthUser(id, email, displayName, null);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return AUTHORITIES;
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    /** Never print the hash, e.g. in logs. */
    @Override
    public String toString() {
        return "AuthUser[id=%d, email=%s]".formatted(id, email);
    }
}
