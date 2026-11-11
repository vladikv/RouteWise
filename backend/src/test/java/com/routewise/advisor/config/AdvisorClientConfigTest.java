package com.routewise.advisor.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

import com.anthropic.client.AnthropicClient;
import com.routewise.advisor.client.AdvisorClient;
import com.routewise.advisor.client.AdvisorClientException;
import com.routewise.advisor.client.ClaudeAdvisorClient;
import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class AdvisorClientConfigTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(AdvisorClientConfig.class);

    @Test
    void withoutApiKey_noAdvisorClient() {
        contextRunner.run(context -> assertThat(context).doesNotHaveBean(AdvisorClient.class));
    }

    @Test
    void withBlankApiKey_noAdvisorClient() {
        contextRunner.withPropertyValues("routewise.advisor.api-key=  ")
                .run(context -> assertThat(context).doesNotHaveBean(AdvisorClient.class));
    }

    @Test
    void withApiKey_createsClaudeAdvisorClientWithDefaults() {
        contextRunner.withPropertyValues("routewise.advisor.api-key=test-key")
                .run(context -> {
                    assertThat(context).hasSingleBean(AdvisorClient.class);
                    assertThat(context.getBean(AdvisorClient.class)).isInstanceOf(ClaudeAdvisorClient.class);
                    AdvisorProperties properties = context.getBean(AdvisorProperties.class);
                    assertThat(properties.model()).isEqualTo("claude-opus-5-5");
                    assertThat(properties.effort()).isEqualTo("low");
                    assertThat(properties.timeout()).isEqualTo(Duration.ofSeconds(20));
                    assertThat(properties.maxRetries()).isEqualTo(1);
                });
    }

    @Test
    void anthropicClient_whenServerIsSlowerThanTimeout_failsFast() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            try {
                Thread.sleep(Duration.ofSeconds(3));
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
            exchange.close();
        });
        server.start();
        AdvisorProperties properties = properties(
                URI.create("http://127.0.0.1:" + server.getAddress().getPort()), Duration.ofMillis(300));
        AdvisorClientConfig config = new AdvisorClientConfig();
        AnthropicClient anthropicClient = config.anthropicClient(properties);
        try {
            AdvisorClient client = config.claudeAdvisorClient(anthropicClient, properties);

            long start = System.nanoTime();
            assertThatThrownBy(() -> client.extractTrip("x", List.of("Berlin"), LocalDate.of(2026, 11, 11)))
                    .isInstanceOf(AdvisorClientException.class);
            assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(2));
        } finally {
            anthropicClient.close();
            server.stop(0);
        }
    }

    @Test
    void propertiesToString_doesNotRevealApiKey() {
        AdvisorProperties properties = properties(URI.create("https://api.anthropic.com"), Duration.ofSeconds(20));

        assertThat(properties.toString()).doesNotContain("sk-ant-secret").contains("apiKey=<set>");
    }

    /** No retries, so a timeout is reported after one attempt. */
    private static AdvisorProperties properties(URI baseUrl, Duration timeout) {
        return new AdvisorProperties("sk-ant-secret", baseUrl, "claude-opus-5-5", "low", 16000, timeout, 0);
    }
}
