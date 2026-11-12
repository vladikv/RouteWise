package com.routewise.advisor;

import static com.routewise.user.TestUsers.csrfCookie;
import static com.routewise.user.TestUsers.withCsrf;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.routewise.advisor.client.AdvisorClient;
import com.routewise.user.TestUsers;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The advisor works through the real wiring without any configuration: no
 * {@link AdvisorClient} bean, rules answer against the seeded cities.
 * The API key is forced blank so a developer's ANTHROPIC_API_KEY cannot leak in.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "routewise.advisor.api-key=")
class AdvisorZeroConfigIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Test
    void parse_withoutApiKey_usesRulesAgainstSeededCities() throws Exception {
        assertThat(context.getBeanNamesForType(AdvisorClient.class)).isEmpty();

        mockMvc.perform(withCsrf(post("/api/advisor/parse"), csrfCookie(mockMvc))
                        .with(user(TestUsers.ALICE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"text": "From Wien to Berlin with 2 friends, as green as possible"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("RULES"))
                .andExpect(jsonPath("$.stops[0].name").value("Vienna"))
                .andExpect(jsonPath("$.stops[1].name").value("Berlin"))
                .andExpect(jsonPath("$.travelers").value(3))
                .andExpect(jsonPath("$.priority").value("GREENEST"))
                .andExpect(jsonPath("$.warnings[0]").value("No departure date recognised."));
    }
}
