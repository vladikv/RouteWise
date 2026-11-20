package com.routewise.flightprice.client;

/** The provider answered, but with an error instead of flights (e.g. an exhausted search quota). */
public class FlightPriceClientException extends RuntimeException {

    public FlightPriceClientException(String message) {
        super(message);
    }
}
