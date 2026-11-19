package com.routewise.pricing.service;

import static com.routewise.pricing.TestPricing.country;
import static com.routewise.pricing.TestPricing.fare;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.pricing.domain.CountryPrice;
import com.routewise.pricing.domain.Fare;
import com.routewise.pricing.domain.LegPricing;
import com.routewise.pricing.domain.PriceBook;
import com.routewise.pricing.repository.CountryPricingRepository;
import com.routewise.pricing.repository.RegionalFareRepository;
import com.routewise.transportmode.domain.TransportModeCode;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PricingServiceTest {

    @Mock
    private CountryPricingRepository countryPricingRepository;

    @Mock
    private RegionalFareRepository regionalFareRepository;

    @InjectMocks
    private PricingService pricingService;

    @Test
    void priceBook_mapsCountriesAndGroupsFaresByRegion() {
        when(countryPricingRepository.findAll()).thenReturn(List.of(country("DE", "EUROPE_WEST", "1.750", "0.000")));
        when(regionalFareRepository.findAll()).thenReturn(List.of(
                fare("EUROPE_WEST", TransportModeCode.TRAIN, "5.00", "0.140"),
                fare("EUROPE_WEST", TransportModeCode.PLANE, "40.00", "0.070")));

        PriceBook book = pricingService.priceBook();

        assertThat(book.countries()).containsOnlyKeys("DE");
        assertThat(book.countries().get("DE"))
                .isEqualTo(new CountryPrice("EUROPE_WEST", new BigDecimal("1.750"), new BigDecimal("0.000")));
        assertThat(book.fares().get("EUROPE_WEST")).containsOnlyKeys(TransportModeCode.TRAIN, TransportModeCode.PLANE)
                .containsEntry(TransportModeCode.PLANE, new Fare(new BigDecimal("40.00"), new BigDecimal("0.070")));
    }

    @Test
    void priceBook_emptyTables_pricesNoLeg() {
        assertThat(pricingService.priceBook().forLeg("DE", "FR")).isEqualTo(LegPricing.NONE);
    }
}
