package com.routewise.user.controller;

import com.routewise.common.exception.InvalidCredentialsException;
import com.routewise.user.domain.AuthUser;
import com.routewise.user.service.UserService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

/**
 * Logs a user in or out of the HTTP session for the JSON auth endpoints (there is
 * no form login). Changes the session id on login against session fixation.
 */
@Component
class SessionLogin {

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();
    private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();

    SessionLogin(AuthenticationManager authenticationManager) {
        this.authenticationManager = authenticationManager;
    }

    /**
     * @throws InvalidCredentialsException for an unknown email or a wrong password
     */
    AuthUser login(String email, String password, HttpServletRequest request, HttpServletResponse response) {
        Authentication result;
        try {
            result = authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(
                    UserService.normalizeEmail(email), password));
        } catch (AuthenticationException ex) {
            throw new InvalidCredentialsException();
        }
        AuthUser user = ((AuthUser) result.getPrincipal()).withoutPassword();
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        SecurityContext context = contextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user, null, user.getAuthorities()));
        contextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);
        return user;
    }

    void logout(HttpServletRequest request, HttpServletResponse response) {
        new SecurityContextLogoutHandler().logout(request, response, contextHolder.getContext().getAuthentication());
    }
}
