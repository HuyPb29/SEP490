package com.sep490.bms.service.promotion;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import com.sep490.bms.dto.promotion.VoucherWriteRequest;
import com.sep490.bms.entity.enums.*;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

/** Kiểm tra ngân sách tối thiểu cho voucher tiền mặt và phân biệt đơn vị phần trăm. */
class VoucherBudgetTests {
    VoucherWriteRequest request(DiscountType type, long discount, long budget) {
        return new VoucherWriteRequest("TEST", "Voucher", VoucherTargetGroup.ALL_PLAYERS, type,
                BigDecimal.valueOf(discount), BigDecimal.ZERO, LocalDate.now(), LocalDate.now().plusDays(1),
                null, 1, 100, BigDecimal.valueOf(budget));
    }
    @Test void amountBudgetMustCoverOneDiscountAndEqualBudgetIsAllowed() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertThat(validator.validate(request(DiscountType.AMOUNT, 10000, 9999)))
                    .anyMatch(error -> error.getPropertyPath().toString().equals("budgetValid"));
            assertThat(validator.validate(request(DiscountType.AMOUNT, 10000, 10000))).isEmpty();
            assertThat(validator.validate(request(DiscountType.PERCENT, 10, 5))).isEmpty();
        }
    }
}
