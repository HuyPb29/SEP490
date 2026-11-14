package com.sep490.bms.dto.feedback;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Nhận trạng thái ẩn hoặc hiện mà người quản lý muốn áp dụng cho đánh giá.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HideReviewRequest {

    @NotNull(message = "Trạng thái ẩn không được để trống")
    private Boolean hidden;
}
