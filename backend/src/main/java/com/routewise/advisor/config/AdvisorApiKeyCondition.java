package com.routewise.advisor.config;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.util.StringUtils;

/**
 * Matches when {@code routewise.advisor.api-key} has text. {@code @ConditionalOnProperty}
 * cannot express this: it treats the empty default ({@code ${ANTHROPIC_API_KEY:}}) as set.
 */
class AdvisorApiKeyCondition implements Condition {

    static final String API_KEY_PROPERTY = "routewise.advisor.api-key";

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        return StringUtils.hasText(context.getEnvironment().getProperty(API_KEY_PROPERTY));
    }
}
