package com.routewise.common.config;

import java.time.Clock;
import java.util.Optional;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Fills {@code @CreatedDate}/{@code @LastModifiedDate} from the injected {@link Clock},
 * so audit timestamps follow the same "now" as every other date rule and are testable.
 * Kept out of the application class so web slices do not need JPA; {@code @DataJpaTest}s
 * that save audited entities import it together with {@link ClockConfig}.
 */
@Configuration
@EnableJpaAuditing(dateTimeProviderRef = "auditingDateTimeProvider")
public class JpaAuditingConfig {

    @Bean
    DateTimeProvider auditingDateTimeProvider(Clock clock) {
        return () -> Optional.of(clock.instant());
    }
}
