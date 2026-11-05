package com.sep490.bms.dto.notification;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** UC37 - Số thông báo chưa đọc, dùng cho badge trên thanh điều hướng. */
@Getter
@AllArgsConstructor
public class UnreadCountResponse {

    private final long unread;
}
