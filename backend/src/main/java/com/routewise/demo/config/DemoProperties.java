package com.routewise.demo.config;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * The public demo account ({@code routewise.demo.*}). Its credentials are meant to
 * be shared (README, login page), so they are not secrets; turn it off with
 * {@code ROUTEWISE_DEMO_ENABLED=false} for a real deployment.
 */
@Validated
@ConfigurationProperties("routewise.demo")
public record DemoProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("demo@routewise.app") @NotBlank @Email String email,
        @DefaultValue("demo1234") @NotBlank @Size(min = 8, max = 72) String password,
        @DefaultValue("Demo traveller") @NotBlank @Size(max = 50) String displayName) {

    /** Keeps the password out of logs. */
    @Override
    public String toString() {
        return "DemoProperties[enabled=%s, email=%s, displayName=%s]".formatted(enabled, email, displayName);
    }
}
