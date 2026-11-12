package com.routewise.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ValidationError;
import com.routewise.user.domain.AppUser;
import com.routewise.user.domain.AuthUser;
import com.routewise.user.dto.RegisterRequest;
import com.routewise.user.repository.AppUserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private AppUserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, passwordEncoder);
    }

    @Test
    void register_storesLowerCaseEmailHashedPasswordAndStrippedName() {
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(passwordEncoder.encode("correct horse")).thenReturn("{hash}");
        when(userRepository.saveAndFlush(any(AppUser.class))).thenAnswer(invocation -> {
            AppUser user = invocation.getArgument(0);
            user.setId(7L);
            return user;
        });

        AuthUser registered = userService.register(
                new RegisterRequest("  Alice@Example.COM ", "correct horse", "  Alice  "));

        ArgumentCaptor<AppUser> saved = ArgumentCaptor.forClass(AppUser.class);
        verify(userRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getEmail()).isEqualTo("alice@example.com");
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("{hash}");
        assertThat(saved.getValue().getDisplayName()).isEqualTo("Alice");
        assertThat(registered).isEqualTo(new AuthUser(7L, "alice@example.com", "Alice", null));
    }

    @Test
    void register_withTakenEmailInOtherCase_throwsFieldValidation() {
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.register(
                new RegisterRequest("ALICE@example.com", "correct horse", "Alice")))
                .isInstanceOf(FieldValidationException.class)
                .extracting(ex -> ((FieldValidationException) ex).getErrors())
                .isEqualTo(List.of(new ValidationError("email", "is already registered")));
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void loadUserByUsername_isCaseInsensitiveAndKeepsHashForPasswordCheck() {
        AppUser alice = new AppUser();
        alice.setId(7L);
        alice.setEmail("alice@example.com");
        alice.setDisplayName("Alice");
        alice.setPasswordHash("{hash}");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(alice));

        UserDetails details = userService.loadUserByUsername(" Alice@Example.com");

        assertThat(details).isEqualTo(new AuthUser(7L, "alice@example.com", "Alice", "{hash}"));
        assertThat(details.getPassword()).isEqualTo("{hash}");
    }

    @Test
    void loadUserByUsername_unknownEmail_throwsUsernameNotFound() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.loadUserByUsername("nobody@example.com"))
                .isInstanceOf(UsernameNotFoundException.class);
    }
}
