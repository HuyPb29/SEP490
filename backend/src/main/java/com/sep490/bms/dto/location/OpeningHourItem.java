package com.sep490.bms.dto.location;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Giờ mở cửa của một thứ trong tuần (FR30). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OpeningHourItem {

    /** 1 = thứ Hai … 7 = Chủ nhật. */
    private int dayOfWeek;
    /** "HH:mm", ví dụ "06:00". */
    private String openTime;
    /** "HH:mm", có thể là "24:00". */
    private String closeTime;
}
