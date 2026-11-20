package com.routewise.flightprice.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.SocketTimeoutException;
import java.time.LocalDate;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

class SerpApiFlightPriceClientTest {

    private static final LocalDate DATE = LocalDate.of(2026, 12, 1);
    private static final String SEARCH = "https://serpapi.test/search";

    private MockRestServiceServer server;
    private SerpApiFlightPriceClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://serpapi.test");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new SerpApiFlightPriceClient(builder.build(), "test-key");
    }

    @Test
    void cheapestOneWayFare_asksForAOneWayEconomyFlightInEurAndReturnsTheCheapest() {
        server.expect(requestTo(Matchers.startsWith(SEARCH)))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("engine", "google_flights"))
                .andExpect(queryParam("type", "2"))
                .andExpect(queryParam("departure_id", "LHR"))
                .andExpect(queryParam("arrival_id", "KRK"))
                .andExpect(queryParam("outbound_date", "2026-12-01"))
                .andExpect(queryParam("adults", "1"))
                .andExpect(queryParam("travel_class", "1"))
                .andExpect(queryParam("currency", "EUR"))
                .andExpect(queryParam("api_key", "test-key"))
                .andRespond(withSuccess("""
                        {"best_flights": [{"price": 118}, {"price": 96}],
                         "other_flights": [{"price": 142}, {"price": 89}, {}]}
                        """, MediaType.APPLICATION_JSON));

        // The cheapest over both lists: 89 (an itinerary without a price is skipped).
        assertThat(client.cheapestOneWayFare("LHR", "KRK", DATE)).hasValueSatisfying(price ->
                assertThat(price).isEqualByComparingTo("89"));
        server.verify();
    }

    @Test
    void cheapestOneWayFare_onlyOtherFlights_usesThem() {
        server.expect(requestTo(Matchers.startsWith(SEARCH)))
                .andRespond(withSuccess("""
                        {"other_flights": [{"price": 210}]}
                        """, MediaType.APPLICATION_JSON));

        assertThat(client.cheapestOneWayFare("LHR", "JFK", DATE)).hasValueSatisfying(price ->
                assertThat(price).isEqualByComparingTo("210"));
    }

    @Test
    void cheapestOneWayFare_noFlightThatDay_isEmpty() {
        server.expect(requestTo(Matchers.startsWith(SEARCH)))
                .andRespond(withSuccess("""
                        {"error": "Google Flights hasn't returned any results for this query."}
                        """, MediaType.APPLICATION_JSON));

        assertThat(client.cheapestOneWayFare("BRQ", "KTI", DATE)).isEmpty();
    }

    @Test
    void cheapestOneWayFare_otherProviderError_throws() {
        server.expect(requestTo(Matchers.startsWith(SEARCH)))
                .andRespond(withSuccess("""
                        {"error": "Your account has run out of searches."}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.cheapestOneWayFare("LHR", "KRK", DATE))
                .isInstanceOf(FlightPriceClientException.class)
                .hasMessageContaining("run out of searches");
    }

    @Test
    void cheapestOneWayFare_onServerError_throws() {
        server.expect(requestTo(Matchers.startsWith(SEARCH))).andRespond(withServerError());

        assertThatThrownBy(() -> client.cheapestOneWayFare("LHR", "KRK", DATE))
                .isInstanceOf(HttpServerErrorException.class);
    }

    @Test
    void cheapestOneWayFare_onTimeout_throwsResourceAccessException() {
        server.expect(requestTo(Matchers.startsWith(SEARCH)))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));

        assertThatThrownBy(() -> client.cheapestOneWayFare("LHR", "KRK", DATE))
                .isInstanceOf(ResourceAccessException.class);
    }
}
