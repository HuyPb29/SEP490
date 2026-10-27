package com.sep490.bms.entity.location;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "opening_exception")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OpeningException {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "exception_date", nullable = false)
    private LocalDate exceptionDate;

    @Column(name = "open_minute", nullable = false)
    private int openMinute;

    @Column(name = "close_minute", nullable = false)
    private int closeMinute;

    @Column(length = 255)
    private String note;
}
