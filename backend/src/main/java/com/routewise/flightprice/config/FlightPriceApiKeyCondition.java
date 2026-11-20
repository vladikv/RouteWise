package com.routewise.flightprice.config;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.util.StringUtils;

/**
 * Matches when {@code routewise.flight-prices.api-key} has text. {@code @ConditionalOnProperty} cannot
 * express this: it treats the empty default ({@code ${ROUTEWISE_FLIGHT_PRICES_API_KEY:}}) as set.
 */
class FlightPriceApiKeyCondition implements Condition {

    static final String API_KEY_PROPERTY = "routewise.flight-prices.api-key";

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        return StringUtils.hasText(context.getEnvironment().getProperty(API_KEY_PROPERTY));
    }
}
