package com.routewise.user.controller;

import java.net.URI;

import com.routewise.user.domain.AuthUser;
import com.routewise.user.dto.LoginRequest;
import com.routewise.user.dto.RegisterRequest;
import com.routewise.user.dto.UserResponse;
import com.routewise.user.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final SessionLogin sessionLogin;

    public AuthController(UserService userService, SessionLogin sessionLogin) {
        this.userService = userService;
        this.sessionLogin = sessionLogin;
    }

    @PostMapping("/register")
    @Operation(summary = "Create an account and log in")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest body,
                                                 HttpServletRequest request, HttpServletResponse response) {
        userService.register(body);
        AuthUser user = sessionLogin.login(body.email(), body.password(), request, response);
        return ResponseEntity.created(URI.create("/api/auth/me")).body(toResponse(user));
    }

    @PostMapping("/login")
    @Operation(summary = "Log in with email and password; starts a session")
    public UserResponse login(@Valid @RequestBody LoginRequest body,
                              HttpServletRequest request, HttpServletResponse response) {
        return toResponse(sessionLogin.login(body.email(), body.password(), request, response));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "End the session")
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        sessionLogin.logout(request, response);
    }

    @GetMapping("/me")
    @Operation(summary = "The logged-in account; 401 when not logged in")
    public UserResponse me(@AuthenticationPrincipal AuthUser user) {
        return toResponse(user);
    }

    private static UserResponse toResponse(AuthUser user) {
        return new UserResponse(user.id(), user.email(), user.displayName());
    }
}
