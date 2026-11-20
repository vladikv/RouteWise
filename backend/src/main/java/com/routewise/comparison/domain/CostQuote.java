package com.routewise.comparison.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * An option's total cost and where it comes from.
 *
 * @param amount      for all travelers (or cars), EUR, rounded to cents
 * @param retrievedAt when the live fare was fetched; {@code null} for an estimate
 */
public record CostQuote(BigDecimal amount, CostSource source, Instant retrievedAt) {

    public static CostQuote estimate(BigDecimal amount) {
        return new CostQuote(amount, CostSource.ESTIMATE, null);
    }
}
