package com.sep490.bms.dto.location;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * UC07 - Owner cập nhật địa điểm. Tất cả trường đều tuỳ chọn:
 * trường null nghĩa là giữ nguyên giá trị hiện tại.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateLocationRequest {

    @Size(max = 100, message = "Tên địa điểm tối đa 100 ký tự")
    private String name;

    @Size(max = 255, message = "Địa chỉ tối đa 255 ký tự")
    private String address;

    @Pattern(regexp = "^0\\d{9}$", message = "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0")
    private String contactPhone;

    @Size(max = 100, message = "Tên ngân hàng tối đa 100 ký tự")
    private String bankName;

    @Size(max = 30, message = "Số tài khoản tối đa 30 ký tự")
    private String bankAccountNo;

    @Size(max = 100, message = "Tên chủ tài khoản tối đa 100 ký tự")
    private String bankAccountHolder;

    @Size(max = 255, message = "Đường dẫn ảnh QR tối đa 255 ký tự")
    private String qrImagePath;

    @Min(value = 1, message = "Số ngày đặt trước tối thiểu là 1")
    @Max(value = 365, message = "Số ngày đặt trước tối đa là 365")
    private Short advanceBookingDays;

    @Min(value = 1000, message = "Tỷ lệ tích điểm tối thiểu là 1000")
    @Max(value = 100000, message = "Tỷ lệ tích điểm tối đa là 100000")
    private Integer pointEarningRate;
}
