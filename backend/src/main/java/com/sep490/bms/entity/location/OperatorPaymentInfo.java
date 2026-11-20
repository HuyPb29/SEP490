package com.sep490.bms.entity.location;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Thông tin nhận chuyển khoản tiền thuê của bên vận hành (FR127, DR28).
 * Bảng chỉ có một dòng (id = 1), tạo sẵn khi cài hệ thống; Admin sửa được.
 * qrImagePath để trống nghĩa là đang dùng ảnh QR mặc định đóng gói trong backend.
 */
@Entity
@Table(name = "operator_payment_info")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OperatorPaymentInfo {

    public static final int SINGLE_ROW_ID = 1;

    @Id
    private Integer id;

    @Column(name = "bank_name", nullable = false, length = 100)
    private String bankName;

    @Column(name = "bank_account_no", nullable = false, length = 30)
    private String bankAccountNo;

    @Column(name = "bank_account_holder", nullable = false, length = 100)
    private String bankAccountHolder;

    @Column(name = "qr_image_path", length = 255)
    private String qrImagePath;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
