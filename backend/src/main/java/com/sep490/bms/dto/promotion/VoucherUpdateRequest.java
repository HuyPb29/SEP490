package com.sep490.bms.dto.promotion;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
/**
 * Nhận cấu hình voucher mới và phiên bản hiện tại để phát hiện cập nhật đồng thời.
 */
public record VoucherUpdateRequest(@NotNull @Min(0) Integer version, @NotNull @Valid VoucherWriteRequest voucher) {}
