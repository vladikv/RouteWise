package com.routewise.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI routeWiseOpenApi() {
        return new OpenAPI().info(new Info()
                .title("RouteWise API")
                .description("Multimodal trip planner: compare train, bus, car, bike and plane "
                        + "by travel time, cost and CO2 emissions.")
                .version("v1"));
    }
}
