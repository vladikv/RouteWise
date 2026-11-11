package com.routewise.weather.config;

import java.net.http.HttpClient;

import com.routewise.weather.client.OpenMeteoWeatherClient;
import com.routewise.weather.client.WeatherClient;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(WeatherProperties.class)
public class WeatherClientConfig {

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
