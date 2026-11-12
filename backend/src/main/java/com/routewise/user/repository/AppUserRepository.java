package com.routewise.user.repository;

import java.util.Optional;

import com.routewise.user.domain.AppUser;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    /** Emails are stored lower-case; pass a lower-cased email. */
    Optional<AppUser> findByEmail(String email);

    boolean existsByEmail(String email);
}
