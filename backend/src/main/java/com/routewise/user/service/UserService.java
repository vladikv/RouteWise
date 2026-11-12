package com.routewise.user.service;

import java.util.Locale;

import com.routewise.common.exception.DuplicateFieldException;
import com.routewise.user.domain.AppUser;
import com.routewise.user.domain.AuthUser;
import com.routewise.user.dto.RegisterRequest;
import com.routewise.user.repository.AppUserRepository;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Accounts: registration, and loading a user for login. Emails are compared
 * case-insensitively by storing them lower-case.
 */
@Service
@Transactional
public class UserService implements UserDetailsService {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(AppUserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Creates an account with a BCrypt-hashed password.
     *
     * @throws DuplicateFieldException (409) when the email already has an account
     */
    public AuthUser register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (isRegistered(email)) {
            throw new DuplicateFieldException("email", "is already registered");
        }
        AppUser user = new AppUser();
        user.setEmail(email);
        user.setDisplayName(request.displayName().strip());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        return AuthUser.of(userRepository.saveAndFlush(user)).withoutPassword();
    }

    @Transactional(readOnly = true)
    public boolean isRegistered(String email) {
        return userRepository.existsByEmail(normalizeEmail(email));
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) {
        return userRepository.findByEmail(normalizeEmail(email))
                .map(AuthUser::of)
                .orElseThrow(() -> new UsernameNotFoundException("No account for this email"));
    }

    public static String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }
}
