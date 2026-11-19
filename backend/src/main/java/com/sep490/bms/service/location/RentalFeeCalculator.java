package com.sep490.bms.service.location;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Feature: F2 - Quản lý địa điểm
 * P35, BR61: số tiền thuê tham khảo = 10.000.000 × số sân con ÷ 9 × số năm thuê, làm tròn lên đến nghìn đồng.
 * Ví dụ 4 sân, 1 năm: 40.000.000 ÷ 9 = 4.444.444,4 → 4.445.000 đồng.
 * Form đăng ký tính cùng công thức để hiện trước; backend tính lại khi lưu, không nhận số tiền từ form (DR19).
 */
public final class RentalFeeCalculator {

    /** P35 (cố định): 10.000.000 đồng cho {@link #REFERENCE_COURTS} sân con trong 1 năm. */
    public static final long REFERENCE_FEE = 10_000_000L;
    public static final int REFERENCE_COURTS = 9;

    private static final BigDecimal THOUSAND = BigDecimal.valueOf(1000);

    private RentalFeeCalculator() {
    }

    public static BigDecimal amount(int courtCount, int rentalYears) {
        if (courtCount < 1 || rentalYears < 1) {
            throw new IllegalArgumentException("Số sân và số năm thuê phải từ 1 trở lên");
        }
        BigDecimal total = BigDecimal.valueOf(REFERENCE_FEE)
                .multiply(BigDecimal.valueOf(courtCount))
                .multiply(BigDecimal.valueOf(rentalYears));
        // Chia cho 9 nghìn rồi làm tròn lên: kết quả là số nghìn đồng, nhân lại 1000.
        return total.divide(BigDecimal.valueOf(REFERENCE_COURTS).multiply(THOUSAND), 0, RoundingMode.CEILING)
                .multiply(THOUSAND);
    }
}
