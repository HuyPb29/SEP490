package com.sep490.bms.dto.feedback;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewReplyRequest {

    @NotBlank(message = "Nội dung phản hồi không được để trống")
    @Size(max = 1000, message = "Phản hồi tối đa 1000 ký tự")
    private String reply;
}
