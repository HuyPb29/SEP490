package com.sep490.bms.dto.request;

import java.util.List;

import jakarta.validation.constraints.*;

public record VoucherGrantRequest(@NotEmpty List<@NotNull @Positive Long> playerIds) {}
