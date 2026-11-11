package com.routewise.advisor.service;

import java.text.Normalizer;
import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.routewise.advisor.domain.TripExtraction;
import com.routewise.trip.domain.TripPriority;

import org.springframework.stereotype.Component;

/**
 * Keyword- and pattern-based trip extraction, used when no LLM is configured or
 * it fails. Understands English requests such as "Berlin to Vienna next Friday,
 * 2 people, as cheap as possible". Holds no state and does no I/O.
 */
@Component
public class RuleBasedTripParser {

    /** Local spellings (already lower-case and without diacritics) of seeded cities. */
    static final Map<String, String> CITY_ALIASES = Map.ofEntries(
            Map.entry("munchen", "Munich"),
            Map.entry("wien", "Vienna"),
            Map.entry("koln", "Cologne"),
            Map.entry("praha", "Prague"),
            Map.entry("roma", "Rome"),
            Map.entry("milano", "Milan"),
            Map.entry("lisboa", "Lisbon"),
            Map.entry("venezia", "Venice"),
            Map.entry("bruxelles", "Brussels"),
            Map.entry("københavn", "Copenhagen"),
            Map.entry("warszawa", "Warsaw"));

    private static final Map<String, Integer> MONTHS = Map.ofEntries(
            Map.entry("january", 1), Map.entry("jan", 1), Map.entry("february", 2), Map.entry("feb", 2),
            Map.entry("march", 3), Map.entry("mar", 3), Map.entry("april", 4), Map.entry("apr", 4),
            Map.entry("may", 5), Map.entry("june", 6), Map.entry("jun", 6), Map.entry("july", 7),
            Map.entry("jul", 7), Map.entry("august", 8), Map.entry("aug", 8), Map.entry("september", 9),
            Map.entry("sept", 9), Map.entry("sep", 9), Map.entry("october", 10), Map.entry("oct", 10),
            Map.entry("november", 11), Map.entry("nov", 11), Map.entry("december", 12), Map.entry("dec", 12));

    private static final Map<String, Integer> NUMBER_WORDS = Map.of(
            "one", 1, "two", 2, "three", 3, "four", 4, "five", 5,
            "six", 6, "seven", 7, "eight", 8, "nine", 9, "ten", 10);

    private static final String MONTH = "(january|february|march|april|may|june|july|august|september|october"
            + "|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)";
    private static final String DAY = "(\\d{1,2})(?:st|nd|rd|th)?";
    private static final String YEAR = "(?:,?\\s+(\\d{4}))?";
    /** At most three digits, so parsing can never overflow. */
    private static final String NUMBER_ALTERNATIVES = "\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten";
    private static final String NUMBER = "(" + NUMBER_ALTERNATIVES + ")";

    private static final Pattern ISO_DATE = Pattern.compile("\\b(\\d{4})-(\\d{1,2})-(\\d{1,2})\\b");
    private static final Pattern DOTTED_DATE = Pattern.compile("\\b(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})\\b");
    private static final Pattern DAY_MONTH = Pattern.compile("\\b" + DAY + "\\s+(?:of\\s+)?" + MONTH + "\\b" + YEAR);
    private static final String PARTY_NOUN = "(?:people|persons|travell?ers|adults|passengers|friends|guests"
            + "|colleagues|kids|children|others|of us)";
    /** The day must not be a head count, so "we may 3 people" is not May 3. */
    private static final Pattern MONTH_DAY = Pattern.compile("\\b" + MONTH + "\\s+" + DAY + "\\b"
            + "(?!\\s+" + PARTY_NOUN + ")" + YEAR);
    private static final Pattern IN_DAYS_OR_WEEKS = Pattern.compile("\\bin\\s+(a|" + NUMBER_ALTERNATIVES
            + ")\\s+(days?|weeks?)\\b");
    private static final Pattern WEEKDAY = Pattern.compile(
            "\\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b");

    private static final Pattern FAMILY_OF = Pattern.compile("\\b(?:family|group)\\s+of\\s+" + NUMBER + "\\b");
    private static final Pattern ADULTS_AND_CHILDREN = Pattern.compile("\\b" + NUMBER
            + "\\s+adults?\\s+and\\s+" + NUMBER + "\\s+(?:kids|children)\\b");
    /** Companions exclude the requester: "with 2 friends", "me and 2 friends". */
    private static final Pattern COMPANIONS = Pattern.compile("\\b(?:with|me and|i and)\\s+(?:my\\s+)?" + NUMBER
            + "\\s+(?:friends|colleagues|kids|children|people|others)\\b");
    /** A party size includes the requester: "2 people", "three adults". */
    private static final Pattern PARTY_SIZE = Pattern.compile("\\b" + NUMBER
            + "\\s+(?:people|persons|travell?ers|adults|passengers|of us)\\b");
    private static final Pattern SOLO = Pattern.compile("\\b(?:alone|solo|by myself|just me|on my own)\\b");
    private static final Pattern PAIR = Pattern.compile("\\b(?:a couple|as a couple|with my (?:wife|husband"
            + "|partner|girlfriend|boyfriend|friend|colleague|mother|father|mom|dad|son|daughter))\\b");

    private static final Pattern FASTEST = Pattern.compile(
            "\\b(?:fast|fastest|faster|quick|quickest|quickly|asap|hurry|urgent|as soon as possible)\\b");
    private static final Pattern CHEAPEST = Pattern.compile(
            "\\b(?:cheap|cheapest|cheaper|budget|inexpensive|affordable|low[- ]cost|save money)\\b");
    private static final Pattern GREENEST = Pattern.compile("\\b(?:green|greenest|greener|eco|sustainable"
            + "|sustainably|environment|environmental|climate|emissions?|co2|carbon)\\b");
    private static final Pattern BALANCED = Pattern.compile("\\bbalanced?\\b");

    private static final Pattern ORIGIN_MARKER = Pattern.compile("\\bfrom\\s+$");
    private static final Pattern DESTINATION_MARKER = Pattern.compile("\\b(?:to|towards)\\s+$");

    /**
     * @param cityNames supported city names; mentions of other cities are ignored
     * @param today     reference date for relative dates
     */
    public TripExtraction parse(String text, List<String> cityNames, LocalDate today) {
        String normalized = normalize(text);
        List<String> cities = findOriginAndDestination(normalized, cityNames);
        return new TripExtraction(
                null,
                cities.get(0),
                cities.get(1),
                findDate(normalized, today).orElse(null),
                findTravelers(normalized).orElse(null),
                findPriority(normalized).orElse(null),
                null);
    }

    /** Lower case without diacritics, so "Zürich" and "Kraków" match "zurich" and "krakow". */
    static String normalize(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }

    /**
     * Returns [origin, destination], each possibly {@code null}. "from X" marks the
     * origin and "to X" the destination; otherwise mentions are taken in order.
     */
    private static List<String> findOriginAndDestination(String text, List<String> cityNames) {
        List<CityMention> mentions = findMentions(text, cityNames);
        String origin = null;
        String destination = null;
        for (CityMention mention : mentions) {
            String before = text.substring(0, mention.start());
            if (origin == null && ORIGIN_MARKER.matcher(before).find()) {
                origin = mention.city();
            } else if (destination == null && DESTINATION_MARKER.matcher(before).find()) {
                destination = mention.city();
            }
        }
        for (CityMention mention : mentions) {
            String city = mention.city();
            if (city.equals(origin) || city.equals(destination)) {
                continue;
            }
            if (origin == null) {
                origin = city;
            } else if (destination == null) {
                destination = city;
            }
        }
        List<String> result = new ArrayList<>();
        result.add(origin);
        result.add(destination);
        return result;
    }

    private static List<CityMention> findMentions(String text, List<String> cityNames) {
        List<CityMention> mentions = new ArrayList<>();
        for (String city : cityNames) {
            addMentions(text, normalize(city), city, mentions);
        }
        CITY_ALIASES.forEach((alias, city) -> {
            if (cityNames.contains(city)) {
                addMentions(text, alias, city, mentions);
            }
        });
        mentions.sort(Comparator.comparingInt(CityMention::start));
        return mentions;
    }

    private static void addMentions(String text, String term, String city, List<CityMention> mentions) {
        Matcher matcher = Pattern.compile("(?<!\\p{L})" + Pattern.quote(term) + "(?!\\p{L})").matcher(text);
        while (matcher.find()) {
            mentions.add(new CityMention(city, matcher.start()));
        }
    }

    /**
     * Explicit dates win over relative ones. Dates without a year mean the next
     * such date (this year, or next year if it has passed). A weekday means its
     * next occurrence after today, also with "next" or "this".
     */
    static Optional<LocalDate> findDate(String text, LocalDate today) {
        Matcher matcher = ISO_DATE.matcher(text);
        if (matcher.find()) {
            return date(Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2)),
                    Integer.parseInt(matcher.group(3)));
        }
        matcher = DOTTED_DATE.matcher(text);
        if (matcher.find()) {
            return date(Integer.parseInt(matcher.group(3)), Integer.parseInt(matcher.group(2)),
                    Integer.parseInt(matcher.group(1)));
        }
        matcher = DAY_MONTH.matcher(text);
        if (matcher.find()) {
            return dayOfMonth(Integer.parseInt(matcher.group(1)), MONTHS.get(matcher.group(2)), matcher.group(3), today);
        }
        matcher = MONTH_DAY.matcher(text);
        if (matcher.find()) {
            return dayOfMonth(Integer.parseInt(matcher.group(2)), MONTHS.get(matcher.group(1)), matcher.group(3), today);
        }
        if (text.contains("day after tomorrow")) {
            return Optional.of(today.plusDays(2));
        }
        if (text.contains("tomorrow")) {
            return Optional.of(today.plusDays(1));
        }
        if (Pattern.compile("\\b(?:today|tonight)\\b").matcher(text).find()) {
            return Optional.of(today);
        }
        matcher = IN_DAYS_OR_WEEKS.matcher(text);
        if (matcher.find()) {
            int amount = "a".equals(matcher.group(1)) ? 1 : number(matcher.group(1));
            return Optional.of(matcher.group(2).startsWith("week") ? today.plusWeeks(amount) : today.plusDays(amount));
        }
        boolean nextWeek = text.contains("next week");
        matcher = WEEKDAY.matcher(text);
        if (matcher.find()) {
            DayOfWeek day = DayOfWeek.valueOf(matcher.group(1).toUpperCase(Locale.ROOT));
            if (nextWeek) {
                // "Friday next week": that weekday in the calendar week (Monday to Sunday) after this one
                return Optional.of(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                        .plusWeeks(1)
                        .with(TemporalAdjusters.nextOrSame(day)));
            }
            return Optional.of(today.with(TemporalAdjusters.next(day)));
        }
        return nextWeek ? Optional.of(today.plusWeeks(1)) : Optional.empty();
    }

    private static Optional<LocalDate> dayOfMonth(int day, int month, String year, LocalDate today) {
        if (year != null) {
            return date(Integer.parseInt(year), month, day);
        }
        return date(today.getYear(), month, day)
                .map(date -> date.isBefore(today) ? date.plusYears(1) : date);
    }

    private static Optional<LocalDate> date(int year, int month, int day) {
        try {
            return Optional.of(LocalDate.of(year, month, day));
        } catch (DateTimeException ex) {
            return Optional.empty();
        }
    }

    /**
     * Counts the requester: "with 2 friends" is 3 travelers. Known limit: mixed
     * phrases such as "my wife and 2 kids" are undercounted; the user can correct
     * the draft in the form.
     */
    static Optional<Integer> findTravelers(String text) {
        Matcher matcher = FAMILY_OF.matcher(text);
        if (matcher.find()) {
            return Optional.of(number(matcher.group(1)));
        }
        matcher = ADULTS_AND_CHILDREN.matcher(text);
        if (matcher.find()) {
            return Optional.of(number(matcher.group(1)) + number(matcher.group(2)));
        }
        matcher = COMPANIONS.matcher(text);
        if (matcher.find()) {
            return Optional.of(number(matcher.group(1)) + 1);
        }
        matcher = PARTY_SIZE.matcher(text);
        if (matcher.find()) {
            return Optional.of(number(matcher.group(1)));
        }
        if (SOLO.matcher(text).find()) {
            return Optional.of(1);
        }
        if (PAIR.matcher(text).find()) {
            return Optional.of(2);
        }
        return Optional.empty();
    }

    /** One clear wish wins; several conflicting wishes mean BALANCED. */
    static Optional<TripPriority> findPriority(String text) {
        Set<TripPriority> wishes = EnumSet.noneOf(TripPriority.class);
        if (FASTEST.matcher(text).find()) {
            wishes.add(TripPriority.FASTEST);
        }
        if (CHEAPEST.matcher(text).find()) {
            wishes.add(TripPriority.CHEAPEST);
        }
        if (GREENEST.matcher(text).find()) {
            wishes.add(TripPriority.GREENEST);
        }
        if (wishes.size() == 1) {
            return Optional.of(wishes.iterator().next());
        }
        if (wishes.size() > 1 || BALANCED.matcher(text).find()) {
            return Optional.of(TripPriority.BALANCED);
        }
        return Optional.empty();
    }

    private static int number(String value) {
        Integer word = NUMBER_WORDS.get(value);
        return word != null ? word : Integer.parseInt(value);
    }

    private record CityMention(String city, int start) {
    }
}
