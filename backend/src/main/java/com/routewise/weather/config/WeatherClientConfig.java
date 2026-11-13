package com.routewise.weather.config;

import java.net.http.HttpClient;

import com.routewise.weather.client.OpenMeteoWeatherClient;
import com.routewise.weather.client.WeatherClient;

import com.github.benmanes.caffeine.cache.Caffeine;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.resilience.annotation.EnableResilientMethods;
import org.springframework.web.client.RestClient;

// Class-based proxies: the retry interceptor reads @Retryable from the invoked method, which
// with an interface (JDK) proxy would be WeatherClient's unannotated method.
@Configuration
@EnableCaching(proxyTargetClass = true)
@EnableResilientMethods(proxyTargetClass = true)
@EnableConfigurationProperties(WeatherProperties.class)
public class WeatherClientConfig {

    /** Upper bound of cached forecasts (about 150 cities × 16 days fit). */
    static final long FORECAST_CACHE_MAX_ENTRIES = 5_000;

    /**
     * The application's only cache. Caffeine because entries must expire after a TTL,
     * which Spring's default {@code ConcurrentMap} cache cannot do.
     */
    @Bean
    CacheManager cacheManager(WeatherProperties properties) {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager(OpenMeteoWeatherClient.FORECAST_CACHE);
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(properties.cacheTtl())
                .maximumSize(FORECAST_CACHE_MAX_ENTRIES));
        return cacheManager;
    }

    @Bean
    WeatherClient weatherClient(RestClient.Builder restClientBuilder, WeatherProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        // Bounds the wait for the response headers (HttpRequest.timeout), not a slow body;
        // Open-Meteo responses are a few hundred bytes, so that is sufficient.
        requestFactory.setReadTimeout(properties.readTimeout());
        RestClient restClient = restClientBuilder
                .baseUrl(properties.baseUrl().toString())
                .requestFactory(requestFactory)
                .build();
        return new OpenMeteoWeatherClient(restClient);
    }
}
