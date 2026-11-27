package com.sep490.bms.dto.promotion;

/** Thông tin nhận diện tối thiểu để Owner chọn người chơi đang hoạt động. */
public record VoucherRecipientResponse(Long id, String username, String fullName) {}
