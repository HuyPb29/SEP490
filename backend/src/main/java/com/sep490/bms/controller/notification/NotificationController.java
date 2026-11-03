package com.sep490.bms.controller.notification;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.notification.NotificationDto;
import com.sep490.bms.dto.notification.UnreadCountResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.notification.NotificationService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: UC37 - Automated tasks and notifications
 * Hộp thư trong ứng dụng: mọi vai trò đã đăng nhập đều xem được thông báo của mình.
 */
@RestController
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /**
     * UC37 - Automated tasks and notifications
     * Status: IMPLEMENTED
     *
     * Mặc định trả 20 thông báo mới nhất; unreadOnly=true để chỉ lấy thông báo chưa đọc.
     */
    @GetMapping("/api/notifications")
    public ResponseEntity<ApiResponse<PageResponse<NotificationDto>>> getNotifications(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(name = "unreadOnly", defaultValue = "false") boolean unreadOnly,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.list(currentUser, unreadOnly, page, size)));
    }

    /**
     * UC37 - Automated tasks and notifications
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/notifications/unread-count")
    public ResponseEntity<ApiResponse<UnreadCountResponse>> getUnreadCount(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(
                new UnreadCountResponse(notificationService.unreadCount(currentUser))));
    }

    /**
     * UC37 - Automated tasks and notifications
     * Status: IMPLEMENTED
     *
     * Chỉ đánh dấu được thông báo của chính mình, thông báo người khác trả 404.
     */
    @PatchMapping("/api/notifications/{id}/read")
    public ResponseEntity<ApiResponse<NotificationDto>> patchNotificationRead(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success("Đã đánh dấu thông báo là đã đọc",
                notificationService.markRead(currentUser, id)));
    }

    /**
     * UC37 - Automated tasks and notifications
     * Status: IMPLEMENTED
     */
    @PatchMapping("/api/notifications/read-all")
    public ResponseEntity<ApiResponse<UnreadCountResponse>> patchNotificationReadAll(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        int updated = notificationService.markAllRead(currentUser);
        return ResponseEntity.ok(ApiResponse.success("Đã đánh dấu tất cả là đã đọc",
                new UnreadCountResponse(updated)));
    }
}
