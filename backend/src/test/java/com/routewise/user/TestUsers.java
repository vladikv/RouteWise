package com.routewise.user;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.routewise.user.domain.AuthUser;

import jakarta.servlet.http.Cookie;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Test users and MockMvc set-ups for web-layer tests that run with the real
 * security rules ({@code @Import(SecurityConfig.class)}).
 * <p>
 * {@code @SpringBootTest} tests must use {@link #csrfCookie} and {@link #withCsrf}
 * instead of Spring Security's {@code csrf()} post-processor: that one replaces the
 * token repository inside the cached context's filter chain for good, so later
 * tests in the same context get no {@code XSRF-TOKEN} cookie.
 */
public final class TestUsers {

    public static final long ALICE_ID = 7L;
    public static final AuthUser ALICE = new AuthUser(ALICE_ID, "alice@example.com", "Alice", null);

    private TestUsers() {
    }

    /** Every request is sent logged in as Alice, with a valid CSRF token. */
    public static MockMvc mockMvcAsAlice(WebApplicationContext context) {
        return MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .defaultRequest(get("/")
                        .with(authentication(UsernamePasswordAuthenticationToken.authenticated(
                                ALICE, null, ALICE.getAuthorities())))
                        .with(csrf()))
                .build();
    }

    /** Requests are sent without a login, with a valid CSRF token. */
    public static MockMvc anonymousMockMvc(WebApplicationContext context) {
        return MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .defaultRequest(get("/").with(csrf()))
                .build();
    }

    /** The {@code XSRF-TOKEN} cookie the API hands out on any request, as a browser receives it. */
    public static Cookie csrfCookie(MockMvc mockMvc) throws Exception {
        return mockMvc.perform(get("/api/cities")).andReturn().getResponse().getCookie("XSRF-TOKEN");
    }

    /** Sends the CSRF cookie and echoes it in the {@code X-XSRF-TOKEN} header, like the UI does. */
    public static MockHttpServletRequestBuilder withCsrf(MockHttpServletRequestBuilder request, Cookie csrf) {
        return request.cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue());
    }
}
