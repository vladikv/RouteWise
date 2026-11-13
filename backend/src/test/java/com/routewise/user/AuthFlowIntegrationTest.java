package com.routewise.user;

import static com.routewise.user.TestUsers.csrfCookie;
import static com.routewise.user.TestUsers.withCsrf;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * The real security filter chain, session and CSRF cookie, the way the SPA uses
 * them: read {@code XSRF-TOKEN} from a cookie, send it back as {@code X-XSRF-TOKEN}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "routewise.advisor.api-key=")
class AuthFlowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void publicEndpoints_workWithoutLoginAndIssueCsrfCookie() throws Exception {
        mockMvc.perform(get("/api/cities")).andExpect(status().isOk());
        Cookie csrf = csrfCookie(mockMvc);
        assertThat(csrf).isNotNull();

        mockMvc.perform(withCsrf(post("/api/comparisons"), csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("Preview")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tripId").doesNotExist());
    }

    @Test
    void protectedEndpoints_withoutLogin_return401() throws Exception {
        mockMvc.perform(get("/api/trips")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void tripsArePrivateToTheirOwner() throws Exception {
        Client alice = register("alice.flow@example.com");
        Client bob = register("bob.flow@example.com");

        MvcResult created = mockMvc.perform(alice.send(post("/api/trips"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("Alice's trip")))
                .andExpect(status().isCreated())
                .andReturn();
        int tripId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(alice.send(get("/api/trips")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(bob.send(get("/api/trips")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(bob.send(get("/api/trips/" + tripId))).andExpect(status().isNotFound());
        mockMvc.perform(bob.send(get("/api/trips/" + tripId + "/comparison"))).andExpect(status().isNotFound());
        mockMvc.perform(bob.send(get("/api/trips/" + tripId + "/advice"))).andExpect(status().isNotFound());
        mockMvc.perform(bob.send(put("/api/trips/" + tripId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("Taken over by Bob")))
                .andExpect(status().isNotFound());
        mockMvc.perform(bob.send(delete("/api/trips/" + tripId))).andExpect(status().isNotFound());

        mockMvc.perform(alice.send(get("/api/trips/" + tripId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Alice's trip"));
    }

    @Test
    void deletedTrip_isHiddenEverywhere_andOnlyItsOwnerCanRestoreIt() throws Exception {
        Client alice = register("alice.undo@example.com");
        Client bob = register("bob.undo@example.com");
        MvcResult created = mockMvc.perform(alice.send(post("/api/trips"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("Undo me")))
                .andExpect(status().isCreated())
                .andReturn();
        String trip = "/api/trips/" + JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(alice.send(delete(trip))).andExpect(status().isNoContent());

        mockMvc.perform(alice.send(get(trip))).andExpect(status().isNotFound());
        mockMvc.perform(alice.send(get(trip + "/comparison"))).andExpect(status().isNotFound());
        mockMvc.perform(alice.send(get(trip + "/advice"))).andExpect(status().isNotFound());
        mockMvc.perform(alice.send(put(trip))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("Edited while deleted")))
                .andExpect(status().isNotFound());
        mockMvc.perform(alice.send(delete(trip))).andExpect(status().isNotFound());
        mockMvc.perform(bob.send(post(trip + "/restore"))).andExpect(status().isNotFound());

        mockMvc.perform(alice.send(post(trip + "/restore")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Undo me"));
        mockMvc.perform(alice.send(get(trip))).andExpect(status().isOk());
        mockMvc.perform(alice.send(post(trip + "/restore"))).andExpect(status().isOk());
    }

    @Test
    void register_takenEmail_returns409() throws Exception {
        register("dave.flow@example.com");

        mockMvc.perform(withCsrf(post("/api/auth/register"), csrfCookie(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "Dave.Flow@example.com", "password": "correct horse", "displayName": "Dave"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].field").value("email"));
    }

    @Test
    void demoAccount_isSeededWithSampleTrips() throws Exception {
        Cookie csrf = csrfCookie(mockMvc);
        MvcResult login = mockMvc.perform(withCsrf(post("/api/auth/login"), csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "demo@routewise.app", "password": "demo1234"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Demo traveller"))
                .andReturn();
        Client demo = new Client((MockHttpSession) login.getRequest().getSession(false), csrf);

        mockMvc.perform(demo.send(get("/api/trips")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].title").value("Weekend in Vienna"))
                .andExpect(jsonPath("$[1].title").value("Central Europe loop"))
                .andExpect(jsonPath("$[1].stops.length()").value(5));
    }

    @Test
    void loginIsCaseInsensitive_logoutEndsTheSession() throws Exception {
        register("carol.flow@example.com");
        Cookie csrf = csrfCookie(mockMvc);

        mockMvc.perform(withCsrf(post("/api/auth/login"), csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "carol.flow@example.com", "password": "wrong password"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid email or password"));

        MvcResult login = mockMvc.perform(withCsrf(post("/api/auth/login"), csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "Carol.Flow@Example.com", "password": "correct horse"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        Client carol = new Client((MockHttpSession) login.getRequest().getSession(false), csrf);

        mockMvc.perform(carol.send(get("/api/auth/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("carol.flow@example.com"));
        mockMvc.perform(carol.send(post("/api/auth/logout"))).andExpect(status().isNoContent());
        mockMvc.perform(carol.send(get("/api/auth/me"))).andExpect(status().isUnauthorized());
    }

    private Client register(String email) throws Exception {
        Cookie csrf = csrfCookie(mockMvc);
        MvcResult result = mockMvc.perform(withCsrf(post("/api/auth/register"), csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "%s", "password": "correct horse", "displayName": "Tester"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        return new Client((MockHttpSession) result.getRequest().getSession(false), csrf);
    }

    private static String tripJson(String title) {
        return """
                {"title": "%s", "stops": [{"cityId": 1}, {"cityId": 2}],
                 "departureDate": "%s", "travelers": 1, "priority": "BALANCED"}
                """.formatted(title, LocalDate.now().plusDays(30));
    }

    /** A logged-in browser: its session plus the CSRF cookie it echoes in a header. */
    private record Client(MockHttpSession session, Cookie csrf) {

        MockHttpServletRequestBuilder send(MockHttpServletRequestBuilder request) {
            return withCsrf(request.session(session), csrf);
        }
    }
}
