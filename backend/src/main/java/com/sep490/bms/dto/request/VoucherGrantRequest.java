package com.sep490.bms.dto.request;

import java.util.List;

import jakarta.validation.constraints.*;

/**
 * Nhận danh sách Player được cấp voucher cá nhân.
 */
public record VoucherGrantRequest(@NotEmpty List<@NotNull @Positive Long> playerIds) {}
