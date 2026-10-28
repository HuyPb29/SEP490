package com.sep490.bms.repository.location;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.OpeningException;

@Repository
public interface OpeningExceptionRepository extends JpaRepository<OpeningException, Long> {
}
