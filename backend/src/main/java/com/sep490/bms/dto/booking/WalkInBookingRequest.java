package com.sep490.bms.dto.booking;

import java.time.LocalDate;

import com.sep490.bms.dto.request.ValidationRules;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Staff tạo booking tại quầy (UC16 #1, FR47, BR43): sân, ngày, giờ và tên, số điện thoại của khách.
 * Không có đội, voucher, điểm, ghi chú: khách tại quầy không có tài khoản (BR09, BR43).
 */
public record WalkInBookingRequest(
        @NotNull @Positive Long courtId,
        @NotNull LocalDate date,
        @Min(0) @Max(1410) int startMinute,
        @Min(30) @Max(1440) int endMinute,
        /** Theo quy tắc họ tên DR24: 2–50 ký tự, chỉ chữ cái và khoảng trắng. */
        @NotBlank(message = "Vui lòng nhập tên khách")
        @Size(min = 2, max = 50, message = "Tên khách phải từ 2 đến 50 ký tự")
        @Pattern(regexp = ValidationRules.NAME, message = "Tên khách chỉ được chứa chữ và khoảng trắng")
        String customerName,
        /** Theo DR01: 10 chữ số, bắt đầu bằng 0. */
        @NotBlank(message = "Vui lòng nhập số điện thoại khách")
        @Pattern(regexp = "^0[0-9]{9}$", message = "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0")
        String customerPhone) {

    @AssertTrue(message = "Slot phải theo bước 30 phút và giờ kết thúc sau giờ bắt đầu")
    public boolean isValidSlot() {
        return startMinute % 30 == 0 && endMinute % 30 == 0 && endMinute > startMinute;
    }
}
