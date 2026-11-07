package com.sep490.bms.service.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.notification.NotificationDto;
import com.sep490.bms.entity.notification.Notification;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.notification.NotificationRepository;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Feature: UC37 - Automated tasks and notifications
 * Hộp thư trong ứng dụng (bảng notification, FR124).
 *
 * Service này vừa phục vụ API cho người dùng đọc thông báo, vừa là nơi duy nhất
 * để các job tự động ghi thông báo vào DB (notifyOnce).
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    /** Cột title NVARCHAR(150), content NVARCHAR(500) - cắt bớt để job không làm hỏng transaction. */
    private static final int TITLE_MAX_LENGTH = 150;
    private static final int CONTENT_MAX_LENGTH = 500;
    private static final int MAX_PAGE_SIZE = 100;

    private final NotificationRepository notificationRepository;

    /** UC37 - Danh sách thông báo của chính người đang đăng nhập. */
    @Transactional(readOnly = true)
    public PageResponse<NotificationDto> list(UserPrincipal user, boolean unreadOnly, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), clampSize(size));
        Page<Notification> result = unreadOnly
                ? notificationRepository
                        .findAllByRecipientIdAndReadFalseOrderByCreatedAtDescIdDesc(user.getId(), pageable)
                : notificationRepository
                        .findAllByRecipientIdOrderByCreatedAtDescIdDesc(user.getId(), pageable);
        return PageResponse.from(result.map(NotificationDto::fromEntity));
    }

    /** UC37 - Số thông báo chưa đọc, dùng cho badge trên thanh điều hướng. */
    @Transactional(readOnly = true)
    public long unreadCount(UserPrincipal user) {
        return notificationRepository.countByRecipientIdAndReadFalse(user.getId());
    }

    /** UC37 - Đánh dấu một thông báo đã đọc. Không đọc được thông báo của người khác. */
    @Transactional
    public NotificationDto markRead(UserPrincipal user, Long notificationId) {
        Notification entity = notificationRepository
                .findByIdAndRecipientId(notificationId, user.getId())
                .orElseThrow(() -> new AppException("Không tìm thấy thông báo", HttpStatus.NOT_FOUND));
        if (!entity.isRead()) {
            entity.setRead(true);
            notificationRepository.save(entity);
        }
        return NotificationDto.fromEntity(entity);
    }

    /** UC37 - Đánh dấu tất cả đã đọc, trả về số bản ghi vừa đổi. */
    @Transactional
    public int markAllRead(UserPrincipal user) {
        return notificationRepository.markAllRead(user.getId());
    }

    /**
     * Ghi một thông báo tự động. Job chạy lặp lại nên phải chống trùng theo
     * (người nhận, loại, refType, refId): cùng một địa điểm hết hạn chỉ báo một lần.
     *
     * @return true nếu có tạo bản ghi mới, false nếu đã tồn tại nên bỏ qua
     */
    @Transactional
    public boolean notifyOnce(Long recipientId, String type, String title, String content,
            String refType, Long refId) {
        if (recipientId == null) {
            return false;
        }
        if (refType != null && refId != null
                && notificationRepository.existsByRecipientIdAndTypeAndRefTypeAndRefId(
                        recipientId, type, refType, refId)) {
            return false;
        }
        notificationRepository.save(Notification.builder()
                .recipientId(recipientId)
                .type(type)
                .title(truncate(title, TITLE_MAX_LENGTH))
                .content(truncate(content, CONTENT_MAX_LENGTH))
                .refType(refType)
                .refId(refId)
                .read(false)
                .build());
        return true;
    }

    private int clampSize(int size) {
        if (size <= 0) {
            return 20;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }

    private String truncate(String value, int maxLength) {
        String safe = value == null ? "" : value;
        return safe.length() <= maxLength ? safe : safe.substring(0, maxLength);
    }
}
