package com.sep490.bms.dto.payment;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * UC19 #2: chi tiết một giao dịch chờ xác nhận cho Staff/Owner: số tiền, người đặt, giờ chơi,
 * ghi chú cho chủ sân (FR35) và các ảnh chứng từ (ảnh mới nhất trước). Ảnh chỉ để tham khảo,
 * căn cứ xác nhận là tiền thực về (BR33).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentDetailResponse {

    private PaymentResponse payment;
    private String courtName;
    private LocalDate playDate;
    private String startTime;
    private String endTime;
    private String customerName;
    private String customerPhone;
    private String note;
    private List<Proof> proofs;

    /** Một lần gửi chứng từ; ảnh lấy qua imageUrl (API có kiểm tra quyền, A03). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Proof {
        private Long id;
        private LocalDateTime uploadedAt;
        private String imageUrl;
    }
}
