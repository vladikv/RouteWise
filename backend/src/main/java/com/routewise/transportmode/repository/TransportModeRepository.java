package com.routewise.transportmode.repository;

import com.routewise.transportmode.domain.TransportMode;
import com.routewise.transportmode.domain.TransportModeCode;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportModeRepository extends JpaRepository<TransportMode, TransportModeCode> {
}
