package com.routewise.pricing.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.routewise.transportmode.domain.TransportModeCode;

/**
 * All regional prices, loaded once per request. Pure: {@link #forLeg} picks and averages the prices of a leg.
 *
 * @param countries by ISO country code
 * @param fares     by fare region, then by ticket mode
 */
public record PriceBook(Map<String, CountryPrice> countries, Map<String, Map<TransportModeCode, Fare>> fares) {

    /** No prices at all: every leg gets {@link LegPricing#NONE}. */
    public static final PriceBook EMPTY = new PriceBook(Map.of(), Map.of());

    private static final int AVERAGE_SCALE = 4;

    public PriceBook {
        countries = Map.copyOf(countries);
        fares = fares.entrySet().stream()
                .collect(Collectors.toUnmodifiableMap(Map.Entry::getKey, entry -> Map.copyOf(entry.getValue())));
    }

    /**
     * Fuel, toll and each mode's fare are averaged over the leg's countries that have them, so a leg from
     * Germany to Poland pays half German and half Polish prices; each country and region counts once, and a
     * country without a row is left out. Flights between regions use the same average, for the whole distance.
     */
    public LegPricing forLeg(String fromCountry, String toCountry) {
        List<CountryPrice> ends = Stream.of(fromCountry, toCountry)
                .distinct()
                .map(countries::get)
                .filter(Objects::nonNull)
                .toList();
        Map<TransportModeCode, Fare> legFares = new EnumMap<>(TransportModeCode.class);
        for (TransportModeCode mode : TransportModeCode.values()) {
            List<Fare> found = ends.stream()
                    .map(CountryPrice::region)
                    .distinct()
                    .map(region -> fares.getOrDefault(region, Map.of()).get(mode))
                    .filter(Objects::nonNull)
                    .toList();
            if (!found.isEmpty()) {
                legFares.put(mode, new Fare(average(found, Fare::baseFareEur), average(found, Fare::costPerKm)));
            }
        }
        if (ends.isEmpty()) {
            return new LegPricing(null, null, legFares);
        }
        return new LegPricing(average(ends, CountryPrice::fuelEurPerLitre), average(ends, CountryPrice::tollEurPerKm),
                legFares);
    }

    private static <T> BigDecimal average(List<T> items, Function<T, BigDecimal> value) {
        BigDecimal sum = items.stream().map(value).reduce(BigDecimal.ZERO, BigDecimal::add);
        return items.size() == 1 ? sum : sum.divide(BigDecimal.valueOf(items.size()), AVERAGE_SCALE,
                RoundingMode.HALF_UP);
    }
}
