package com.sep490.bms.dto.notification;

import java.time.LocalDateTime;

import com.sep490.bms.entity.notification.Notification;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** UC37 - Một thông báo trong hộp thư của người dùng. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationDto {

    private Long id;
    private String type;
    private String title;
    private String content;
    private String refType;
    private Long refId;
    private boolean read;
    private LocalDateTime createdAt;

    public static NotificationDto fromEntity(Notification entity) {
        if (entity == null) {
            return null;
        }
        return NotificationDto.builder()
                .id(entity.getId())
                .type(entity.getType())
                .title(entity.getTitle())
                .content(entity.getContent())
                .refType(entity.getRefType())
                .refId(entity.getRefId())
                .read(entity.isRead())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
