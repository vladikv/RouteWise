package com.routewise.transportmode.service;

import java.util.Comparator;
import java.util.List;

import com.routewise.transportmode.domain.TransportMode;
import com.routewise.transportmode.dto.TransportModeResponse;
import com.routewise.transportmode.mapper.TransportModeMapper;
import com.routewise.transportmode.repository.TransportModeRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TransportModeService {

    private final TransportModeRepository transportModeRepository;
    private final TransportModeMapper transportModeMapper;

    public TransportModeService(TransportModeRepository transportModeRepository,
                                TransportModeMapper transportModeMapper) {
        this.transportModeRepository = transportModeRepository;
        this.transportModeMapper = transportModeMapper;
    }

    /**
     * Returns all modes in the declaration order of {@code TransportModeCode}.
     */
    public List<TransportModeResponse> findAll() {
        return transportModeRepository.findAll().stream()
                .sorted(Comparator.comparing(TransportMode::getCode))
                .map(transportModeMapper::toResponse)
                .toList();
    }
}
