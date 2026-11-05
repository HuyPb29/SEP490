package com.sep490.bms.repository.notification;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.notification.Notification;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** UC37 - Hộp thư của một người, mới nhất lên đầu. */
    Page<Notification> findAllByRecipientIdOrderByCreatedAtDescIdDesc(Long recipientId, Pageable pageable);

    Page<Notification> findAllByRecipientIdAndReadFalseOrderByCreatedAtDescIdDesc(
            Long recipientId, Pageable pageable);

    long countByRecipientIdAndReadFalse(Long recipientId);

    /** Chỉ cho phép đọc thông báo của chính mình. */
    Optional<Notification> findByIdAndRecipientId(Long id, Long recipientId);

    /**
     * Job chạy lặp lại nên phải chống trùng: cùng người nhận + loại + đối tượng
     * (ví dụ cùng một địa điểm hết hạn) thì chỉ sinh một thông báo.
     */
    boolean existsByRecipientIdAndTypeAndRefTypeAndRefId(
            Long recipientId, String type, String refType, Long refId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Notification n set n.read = true where n.recipientId = :recipientId and n.read = false")
    int markAllRead(@Param("recipientId") Long recipientId);
}
