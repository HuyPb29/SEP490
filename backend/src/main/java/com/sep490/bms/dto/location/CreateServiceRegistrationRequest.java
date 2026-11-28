package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import com.sep490.bms.dto.request.ValidationRules;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC05 - Guest hoặc Owner gửi đơn đăng ký đưa địa điểm vào sử dụng hệ thống (FR10, DR19).
 * Multipart: "data" là JSON này; "proof" là ảnh chuyển khoản;
 * "identityDocument" và "businessLicense" là giấy tờ JPG/PNG/PDF.
 * Không có trường số tiền: backend tự tính theo P35.
 *
 * Ràng buộc theo BMS_database.sql: ck_sreg_courts (court_count > 0),
 * ck_sreg_phone_digits (số điện thoại đúng 10 chữ số), toạ độ decimal(9,6).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateServiceRegistrationRequest {

    @NotBlank(message = "Tên địa điểm không được để trống")
    @Size(max = 100, message = "Tên địa điểm tối đa 100 ký tự")
    private String locationName;

    @NotBlank(message = "Địa chỉ không được để trống")
    @Size(max = 255, message = "Địa chỉ tối đa 255 ký tự")
    private String address;

    @NotNull(message = "Vĩ độ không được để trống")
    @DecimalMin(value = "-90", message = "Vĩ độ phải nằm trong khoảng -90 đến 90")
    @DecimalMax(value = "90", message = "Vĩ độ phải nằm trong khoảng -90 đến 90")
    private BigDecimal latitude;

    @NotNull(message = "Kinh độ không được để trống")
    @DecimalMin(value = "-180", message = "Kinh độ phải nằm trong khoảng -180 đến 180")
    @DecimalMax(value = "180", message = "Kinh độ phải nằm trong khoảng -180 đến 180")
    private BigDecimal longitude;

    @NotNull(message = "Số sân không được để trống")
    @Min(value = 1, message = "Số sân phải lớn hơn 0")
    private Integer courtCount;

    /** DR19, DR29: số năm thuê nguyên, từ 1 trở lên. Trần 10 năm là đề xuất, chưa duyệt (chặn số tiền vô lý). */
    @NotNull(message = "Số năm thuê không được để trống")
    @Min(value = 1, message = "Số năm thuê tối thiểu là 1 năm")
    @Max(value = 10, message = "Số năm thuê tối đa là 10 năm")
    private Integer rentalYears;

    /** BR65: phải đánh dấu đồng ý điều khoản sử dụng dịch vụ mới gửi được đơn. */
    @AssertTrue(message = "Vui lòng đọc và đồng ý điều khoản sử dụng dịch vụ")
    private Boolean termsAccepted;

    @AssertTrue(message = "Vui lòng đồng ý cam kết bảo mật và xác minh hồ sơ")
    private Boolean privacyAccepted;

    @Size(max = 50, message = "Tên người liên hệ tối đa 50 ký tự")
    @Pattern(regexp = ValidationRules.NAME, message = "Họ tên chỉ được chứa chữ và khoảng trắng, không chứa số hoặc ký tự đặc biệt")
    private String contactName;

    @Pattern(regexp = "^0[0-9]{9}$", message = "Số điện thoại liên hệ phải gồm đúng 10 chữ số và bắt đầu bằng 0")
    private String contactPhone;

    @Email(message = "Email liên hệ không hợp lệ")
    @Size(max = 100, message = "Email liên hệ tối đa 100 ký tự")
    private String contactEmail;
}
