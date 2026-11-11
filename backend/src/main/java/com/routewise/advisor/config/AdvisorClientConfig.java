package com.routewise.advisor.config;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.OutputConfig;
import com.routewise.advisor.client.AdvisorClient;
import com.routewise.advisor.client.ClaudeAdvisorClient;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;

/**
 * Creates the Claude {@link AdvisorClient} only when an API key is configured;
 * otherwise no bean exists and {@code AdvisorService} uses its rules.
 */
@Configuration
@EnableConfigurationProperties(AdvisorProperties.class)
public class AdvisorClientConfig {

    @Bean(destroyMethod = "close")
    @Conditional(AdvisorApiKeyCondition.class)
    AnthropicClient anthropicClient(AdvisorProperties properties) {
        return AnthropicOkHttpClient.builder()
                .apiKey(properties.apiKey())
                .baseUrl(properties.baseUrl().toString())
                .timeout(properties.timeout())
                .maxRetries(properties.maxRetries())
                .build();
    }

    @Bean
    @Conditional(AdvisorApiKeyCondition.class)
    AdvisorClient claudeAdvisorClient(AnthropicClient anthropicClient, AdvisorProperties properties) {
        return new ClaudeAdvisorClient(anthropicClient, properties.model(),
                OutputConfig.Effort.of(properties.effort()), properties.maxTokens());
    }
}
