package com.sep490.bms.dto.location;

import java.time.LocalDateTime;

import com.sep490.bms.entity.location.OperatorPaymentInfo;
import com.sep490.bms.service.location.RentalFeeCalculator;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * FR10, FR127: thông tin nhận chuyển khoản của bên vận hành hiện trên form đăng ký, kèm mức P35 để form tự tính tiền.
 * Ảnh QR lấy ở GET /api/service-registrations/payment-info/qr (luôn có: ảnh Admin tải lên hoặc ảnh mặc định).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OperatorPaymentInfoDto {

    private String bankName;

    private String bankAccountNo;

    private String bankAccountHolder;

    /** false = đang dùng ảnh QR mặc định khi cài hệ thống. */
    private boolean customQr;

    private LocalDateTime updatedAt;

    /** P35: 10.000.000 đồng cho {@link #referenceCourts} sân con trong 1 năm. */
    private long referenceFee;

    private int referenceCourts;

    public static OperatorPaymentInfoDto fromEntity(OperatorPaymentInfo entity) {
        return OperatorPaymentInfoDto.builder()
                .bankName(entity.getBankName())
                .bankAccountNo(entity.getBankAccountNo())
                .bankAccountHolder(entity.getBankAccountHolder())
                .customQr(entity.getQrImagePath() != null && !entity.getQrImagePath().isBlank())
                .updatedAt(entity.getUpdatedAt())
                .referenceFee(RentalFeeCalculator.REFERENCE_FEE)
                .referenceCourts(RentalFeeCalculator.REFERENCE_COURTS)
                .build();
    }
}
