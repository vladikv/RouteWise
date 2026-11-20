package com.routewise.flightprice.config;

import java.net.http.HttpClient;

import com.routewise.flightprice.client.FlightPriceClient;
import com.routewise.flightprice.client.SerpApiFlightPriceClient;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.resilience.annotation.EnableResilientMethods;
import org.springframework.web.client.RestClient;

/**
 * Creates the SerpApi {@link FlightPriceClient} only when an API key is configured; otherwise no bean
 * exists and {@code FlightPriceService} returns no fares.
 */
// Class-based proxies, as for the weather client: the retry interceptor reads @Retryable from the
// implementation's method, which an interface (JDK) proxy would hide.
@Configuration
@EnableResilientMethods(proxyTargetClass = true)
@EnableConfigurationProperties(FlightPriceProperties.class)
public class FlightPriceClientConfig {

    @Bean
    @Conditional(FlightPriceApiKeyCondition.class)
    FlightPriceClient flightPriceClient(RestClient.Builder restClientBuilder, FlightPriceProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        // Bounds the wait for the response headers; SerpApi answers in one small JSON body.
        requestFactory.setReadTimeout(properties.readTimeout());
        RestClient restClient = restClientBuilder
                .baseUrl(properties.baseUrl().toString())
                .requestFactory(requestFactory)
                .build();
        return new SerpApiFlightPriceClient(restClient, properties.apiKey());
    }
}
