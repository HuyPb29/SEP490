package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.sep490.bms.dto.request.BookingRequest;

import tools.jackson.databind.json.JsonMapper;

/** Body thật đi qua bước đọc JSON: test của service không thấy lỗi ở bước này. */
class BookingRequestJsonTests {

    @Test
    void discountFieldsAreOptional() {
        BookingRequest request = new JsonMapper().readValue(
                "{\"courtId\":1,\"date\":\"2026-11-26\",\"startMinute\":1080,\"endMinute\":1140}",
                BookingRequest.class);

        assertThat(request.courtId()).isEqualTo(1L);
        assertThat(request.date()).isEqualTo(LocalDate.of(2026, 11, 26));
        assertThat(request.voucherCode()).isNull();
        assertThat(request.voucherGrantId()).isNull();
        assertThat(request.pointsToUse()).isNull();
        assertThat(request.teamId()).isNull();
    }
}
