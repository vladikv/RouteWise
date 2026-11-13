package com.routewise.advisor.client;

import static com.routewise.advisor.AdvisorTestData.TODAY;
import static com.routewise.advisor.AdvisorTestData.berlinPragueVienna;
import static com.routewise.advisor.AdvisorTestData.berlinToVienna;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.OutputConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.routewise.advisor.domain.AdviceContext;
import com.routewise.advisor.domain.AdviceText;
import com.routewise.advisor.domain.TripExtraction;
import com.routewise.trip.domain.TripPriority;
import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Runs the real SDK client against a local fake of the Messages API
 * (no external calls). Timeouts are covered by {@code AdvisorClientConfigTest}.
 */
class ClaudeAdvisorClientTest {

    private static final List<String> BERLIN_VIENNA = List.of("Berlin", "Vienna");

    private static final ObjectMapper JSON = new ObjectMapper();

    private HttpServer server;
    private volatile int status = 200;
    private volatile String responseBody;
    private volatile Duration responseDelay = Duration.ZERO;
    private volatile JsonNode lastRequest;
    private volatile Map<String, List<String>> lastHeaders;
    private AnthropicClient anthropicClient;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            lastHeaders = Map.copyOf(exchange.getRequestHeaders());
            lastRequest = JSON.readTree(exchange.getRequestBody());
            sleep(responseDelay);
            byte[] body = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        if (anthropicClient != null) {
            anthropicClient.close();
        }
        server.stop(0);
    }

    @Test
    void extractTrip_validResponse_mapsFieldsAndSendsStructuredRequest() throws Exception {
        respondWithText("end_turn", """
                {"title": "Weekend in Vienna", "stops": ["Berlin", "Vienna", "Berlin"],
                 "departureDate": "2026-11-13", "laterDates": true, "travelers": 2, "priority": "CHEAPEST",
                 "notes": " "}
                """);

        TripExtraction result = client().extractTrip("Berlin to Wien next Friday and back Sunday, 2 of us, cheap",
                List.of("Berlin", "Vienna"), TODAY);

        assertThat(result).isEqualTo(new TripExtraction("Weekend in Vienna", List.of("Berlin", "Vienna", "Berlin"),
                LocalDate.of(2026, 11, 13), true, 2, TripPriority.CHEAPEST, null));
        assertThat(lastRequest.path("model").asText()).isEqualTo("claude-opus-5-5");
        assertThat(lastRequest.path("system").asText()).isEqualTo(ClaudeAdvisorClient.EXTRACTION_SYSTEM_PROMPT);
        assertThat(lastRequest.path("output_config").path("effort").asText()).isEqualTo("low");
        assertThat(lastRequest.path("output_config").path("format").path("type").asText()).isEqualTo("json_schema");
        assertThat(lastRequest.path("fallbacks").asText()).isEqualTo("default");
        assertThat(lastRequest.path("messages").path(0).path("content").asText())
                .contains("Supported cities: Berlin, Vienna", "Today: 2026-11-11 (WEDNESDAY)",
                        "<request>\nBerlin to Wien next Friday and back Sunday, 2 of us, cheap\n</request>");
        assertThat(header("authorization")).isEqualTo("Bearer test-key");
        assertThat(header("anthropic-beta")).contains(ClaudeAdvisorClient.FALLBACK_BETA);
    }

    @Test
    void extractTrip_unknownValues_becomeNull() throws Exception {
        respondWithText("end_turn", """
                {"title": "", "stops": [" ", "Vienna"], "departureDate": "next friday", "laterDates": false,
                 "travelers": 0, "priority": "BALANCED", "notes": ""}
                """);

        TripExtraction result = client().extractTrip("to Vienna", List.of("Vienna"), TODAY);

        assertThat(result).isEqualTo(new TripExtraction(null, List.of("Vienna"), null, false, null,
                TripPriority.BALANCED, null));
    }

    @Test
    void writeAdvice_validResponse_sendsFactsAndCleansTips() throws Exception {
        respondWithText("end_turn", """
                {"summary": "Take the train.", "legs": ["Train to Vienna."],
                 "tips": ["Pack an umbrella.", " ", "a", "b", "c", "d"]}
                """);

        AdviceText advice = client().writeAdvice(new AdviceContext(BERLIN_VIENNA, berlinToVienna()));

        assertThat(advice).isEqualTo(new AdviceText("Take the train.", List.of("Train to Vienna."),
                List.of("Pack an umbrella.", "a", "b", "c")));
        assertThat(lastRequest.path("system").asText()).isEqualTo(ClaudeAdvisorClient.ADVICE_SYSTEM_PROMPT);
        assertThat(lastRequest.path("messages").path(0).path("content").asText())
                .contains("Route: Berlin → Vienna on 2026-11-20", "TRAIN (recommended): 373 min");
    }

    @Test
    void writeAdvice_legSentencesNotMatchingTheLegs_throws() throws Exception {
        respondWithText("end_turn", """
                {"summary": "Train, then bus.", "legs": ["Train to Prague."], "tips": []}
                """);

        assertThatThrownBy(() -> client().writeAdvice(new AdviceContext(List.of("Berlin", "Prague", "Vienna"),
                berlinPragueVienna())))
                .isInstanceOf(AdvisorClientException.class)
                .hasMessageContaining("1 leg sentences for 2 legs");
    }

    @Test
    void writeAdvice_blankSummary_throws() throws Exception {
        respondWithText("end_turn", """
                {"summary": " ", "legs": ["x"], "tips": []}
                """);

        assertThatThrownBy(() -> client()
                .writeAdvice(new AdviceContext(BERLIN_VIENNA, berlinToVienna())))
                .isInstanceOf(AdvisorClientException.class)
                .hasMessageContaining("without a summary");
    }

    @Test
    void writeAdvice_overlongSummary_throwsAndOverlongTipsAreDropped() throws Exception {
        String longTip = "t".repeat(ClaudeAdvisorClient.MAX_TIP_LENGTH + 1);
        respondWithText("end_turn", JSON.writeValueAsString(Map.of(
                "summary", "Take the train.", "legs", List.of("Train."), "tips", List.of(longTip, "Short tip."))));

        assertThat(client().writeAdvice(new AdviceContext(BERLIN_VIENNA, berlinToVienna())).tips())
                .containsExactly("Short tip.");

        respondWithText("end_turn", JSON.writeValueAsString(Map.of(
                "summary", "s".repeat(ClaudeAdvisorClient.MAX_SUMMARY_LENGTH + 1), "legs", List.of("Train."),
                "tips", List.of())));

        assertThatThrownBy(() -> client().writeAdvice(new AdviceContext(BERLIN_VIENNA, berlinToVienna())))
                .isInstanceOf(AdvisorClientException.class)
                .hasMessageContaining("summary of 401 characters");
    }

    @Test
    void extractTrip_maxTokensReached_throws() throws Exception {
        respondWithText("max_tokens", "{\"title\": \"Wee");

        assertThatThrownBy(() -> client().extractTrip("x", List.of("Berlin"), TODAY))
                .isInstanceOf(AdvisorClientException.class)
                .hasMessageContaining("max_tokens");
    }

    @Test
    void extractTrip_malformedJsonText_throws() throws Exception {
        respondWithText("end_turn", "not json");

        assertThatThrownBy(() -> client().extractTrip("x", List.of("Berlin"), TODAY))
                .isInstanceOf(AdvisorClientException.class);
    }

    @Test
    void extractTrip_noTextBlock_throws() throws Exception {
        respond(200, messageJson("end_turn", List.of()));

        assertThatThrownBy(() -> client().extractTrip("x", List.of("Berlin"), TODAY))
                .isInstanceOf(AdvisorClientException.class)
                .hasMessageContaining("no text block");
    }

    @Test
    void extractTrip_refusal_throws() throws Exception {
        respond(200, messageJson("refusal", List.of()));

        assertThatThrownBy(() -> client().extractTrip("x", List.of("Berlin"), TODAY))
                .isInstanceOf(AdvisorClientException.class)
                .hasMessageContaining("refusal");
    }

    @Test
    void extractTrip_serverError_throws() {
        respond(500, """
                {"type": "error", "error": {"type": "api_error", "message": "Internal server error"}}
                """);

        assertThatThrownBy(() -> client().extractTrip("x", List.of("Berlin"), TODAY))
                .isInstanceOf(AdvisorClientException.class)
                .hasMessageContaining("request failed");
    }

    @Test
    void extractTrip_slowerThanTheTimeout_throwsSoTheServiceFallsBackToRules() throws Exception {
        respondWithText("end_turn", "{}");
        responseDelay = Duration.ofSeconds(3);
        ClaudeAdvisorClient client = client(Duration.ofMillis(300));

        long start = System.nanoTime();
        assertThatThrownBy(() -> client.extractTrip("x", List.of("Berlin"), TODAY))
                .isInstanceOf(AdvisorClientException.class);
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(2));
    }

    private ClaudeAdvisorClient client() {
        return client(Duration.ofSeconds(10));
    }

    private ClaudeAdvisorClient client(Duration timeout) {
        anthropicClient = AnthropicOkHttpClient.builder()
                .apiKey("test-key")
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort())
                .maxRetries(0)
                .timeout(timeout)
                .build();
        return new ClaudeAdvisorClient(anthropicClient, "claude-opus-5-5", OutputConfig.Effort.LOW, 16000);
    }

    private static void sleep(Duration duration) {
        try {
            Thread.sleep(duration);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }

    private void respondWithText(String stopReason, String text) throws Exception {
        respond(200, messageJson(stopReason, List.of(Map.of("type", "text", "text", text))));
    }

    private void respond(int status, String body) {
        this.status = status;
        this.responseBody = body;
    }

    private static String messageJson(String stopReason, List<Map<String, String>> content) throws Exception {
        return JSON.writeValueAsString(Map.of(
                "id", "msg_test",
                "type", "message",
                "role", "assistant",
                "model", "claude-opus-5-5",
                "content", content,
                "stop_reason", stopReason,
                "usage", Map.of("input_tokens", 10, "output_tokens", 20)));
    }

    private String header(String name) {
        return lastHeaders.entrySet().stream()
                .filter(entry -> entry.getKey().equalsIgnoreCase(name))
                .map(entry -> String.join(",", entry.getValue()))
                .findFirst()
                .orElse(null);
    }
}
