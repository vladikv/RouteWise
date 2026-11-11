package com.routewise.transportmode.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;

import com.routewise.transportmode.domain.TransportMode;
import com.routewise.transportmode.domain.TransportModeCode;
import com.routewise.transportmode.dto.TransportModeResponse;
import com.routewise.transportmode.mapper.TransportModeMapper;
import com.routewise.transportmode.repository.TransportModeRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class TransportModeServiceTest {

    @Mock
    private TransportModeRepository transportModeRepository;

    @Test
    void findAll_returnsModesInEnumOrder() {
        when(transportModeRepository.findAll()).thenReturn(List.of(
                mode(TransportModeCode.PLANE), mode(TransportModeCode.TRAIN), mode(TransportModeCode.BIKE)));
        TransportModeService service = new TransportModeService(transportModeRepository, new TransportModeMapper());

        List<TransportModeResponse> modes = service.findAll();

        assertThat(modes).extracting(TransportModeResponse::code)
                .containsExactly(TransportModeCode.TRAIN, TransportModeCode.BIKE, TransportModeCode.PLANE);
        assertThat(modes.getFirst().costPerKm()).isEqualByComparingTo("0.1");
    }

    private static TransportMode mode(TransportModeCode code) {
        TransportMode mode = BeanUtils.instantiateClass(TransportMode.class);
        ReflectionTestUtils.setField(mode, "code", code);
        ReflectionTestUtils.setField(mode, "avgSpeedKmh", 100);
        ReflectionTestUtils.setField(mode, "costPerKm", new BigDecimal("0.100"));
        return mode;
    }
}
