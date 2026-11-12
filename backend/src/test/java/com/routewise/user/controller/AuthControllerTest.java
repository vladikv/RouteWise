package com.routewise.user.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.routewise.common.config.SecurityConfig;
import com.routewise.common.exception.DuplicateFieldException;
import com.routewise.common.exception.InvalidCredentialsException;
import com.routewise.user.TestUsers;
import com.routewise.user.dto.RegisterRequest;
import com.routewise.user.service.UserService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@Import(SecurityConfig.class)
@WebMvcTest(AuthController.class)
class AuthControllerTest {

    private static final String REGISTER_BODY = """
            {"email": "alice@example.com", "password": "correct horse", "displayName": "Alice"}
            """;
    private static final String LOGIN_BODY = """
            {"email": "alice@example.com", "password": "correct horse"}
            """;

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private SessionLogin sessionLogin;

    @Test
    void register_createsAccountAndLogsIn() throws Exception {
        when(sessionLogin.login(eq("alice@example.com"), eq("correct horse"), any(), any()))
                .thenReturn(TestUsers.ALICE);

        anonymous().perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(REGISTER_BODY))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/auth/me"))
                .andExpect(jsonPath("$.id").value(TestUsers.ALICE_ID))
                .andExpect(jsonPath("$.email").value("alice@example.com"))
                .andExpect(jsonPath("$.displayName").value("Alice"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        verify(userService).register(new RegisterRequest("alice@example.com", "correct horse", "Alice"));
    }

    @Test
    void register_invalidBody_returns400WithFieldErrors() throws Exception {
        anonymous().perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("""
                        {"email": "not-an-email", "password": "short", "displayName": ""}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.errors[?(@.field == 'email')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'password')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'displayName')]").exists());
        verifyNoInteractions(userService, sessionLogin);
    }

    @Test
    void register_takenEmail_returns409WithFieldError() throws Exception {
        when(userService.register(any())).thenThrow(new DuplicateFieldException("email", "is already registered"));

        anonymous().perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(REGISTER_BODY))
                .andExpect(status().isConflict())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Conflict"))
                .andExpect(jsonPath("$.detail").value("email is already registered"))
                .andExpect(jsonPath("$.errors[0].field").value("email"))
                .andExpect(jsonPath("$.errors[0].message").value("is already registered"));
        verifyNoInteractions(sessionLogin);
    }

    @Test
    void login_validCredentials_returnsUser() throws Exception {
        when(sessionLogin.login(eq("alice@example.com"), eq("correct horse"), any(), any()))
                .thenReturn(TestUsers.ALICE);

        anonymous().perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("alice@example.com"));
    }

    @Test
    void login_invalidCredentials_returns401ProblemDetail() throws Exception {
        when(sessionLogin.login(any(), any(), any(), any())).thenThrow(new InvalidCredentialsException());

        anonymous().perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("Invalid email or password"));
    }

    @Test
    void login_blankFields_returns400() throws Exception {
        anonymous().perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("""
                        {"email": "", "password": ""}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.length()").value(2));
        verifyNoInteractions(sessionLogin);
    }

    @Test
    void login_withoutCsrfToken_returns403ProblemDetail() throws Exception {
        MockMvc withoutCsrf = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        withoutCsrf.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isForbidden())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value(
                        "The request is missing a valid CSRF token; reload the page and try again"));
        verifyNoInteractions(sessionLogin);
    }

    @Test
    void logout_returns204() throws Exception {
        TestUsers.mockMvcAsAlice(context).perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent());
        verify(sessionLogin).logout(any(), any());
    }

    @Test
    void me_loggedIn_returnsUser() throws Exception {
        TestUsers.mockMvcAsAlice(context).perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TestUsers.ALICE_ID))
                .andExpect(jsonPath("$.displayName").value("Alice"));
    }

    @Test
    void me_notLoggedIn_returns401ProblemDetail() throws Exception {
        anonymous().perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("Please log in to continue"));
    }

    private MockMvc anonymous() {
        return TestUsers.anonymousMockMvc(context);
    }
}
