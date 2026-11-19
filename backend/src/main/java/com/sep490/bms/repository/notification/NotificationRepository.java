package com.sep490.bms.repository.notification;

import java.util.Optional;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.notification.Notification;

/**
 * Tra cứu thông báo theo người nhận và cập nhật trạng thái đã đọc.
 */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    interface ReferenceDetails {
        Long getNotificationId();
        Long getLocationId();
        Long getBookingId();
        Long getPackageId();
        Long getRescheduleRequestId();
    }

    /** Resolve references in one query, including notifications created before navigation support. */
    @Query(value = """
            SELECT n.id AS notificationId,
                   COALESCE(b.location_id, bp.location_id, p.location_id, c.location_id,
                            r.location_id, st.location_id, v.location_id, sr.location_id,
                            mb.location_id, mc.location_id, ct.location_id,
                            CASE WHEN n.ref_type = 'LOCATION' THEN n.ref_id END) AS locationId,
                   COALESCE(b.id, p.booking_id, c.booking_id, r.booking_id, mb.id) AS bookingId,
                   COALESCE(bp.id, p.package_id) AS packageId,
                   p.reschedule_request_id AS rescheduleRequestId
            FROM notification n
            LEFT JOIN booking b ON n.ref_type = 'BOOKING' AND n.ref_id = b.id
            LEFT JOIN booking_package bp ON n.ref_type = 'PACKAGE' AND n.ref_id = bp.id
            LEFT JOIN payment p ON n.ref_type = 'PAYMENT' AND n.ref_id = p.id
            LEFT JOIN complaint c ON n.ref_type = 'COMPLAINT' AND n.ref_id = c.id
            LEFT JOIN review r ON n.ref_type = 'REVIEW' AND n.ref_id = r.id
            LEFT JOIN service_term st ON n.ref_type = 'SERVICE_TERM' AND n.ref_id = st.id
            LEFT JOIN voucher v ON n.ref_type = 'VOUCHER' AND n.ref_id = v.id
            LEFT JOIN service_registration sr ON n.ref_type = 'SERVICE_REGISTRATION' AND n.ref_id = sr.id
            LEFT JOIN [match] m ON n.ref_type = 'MATCH' AND n.ref_id = m.id
            LEFT JOIN booking mb ON mb.id = m.booking_id
            LEFT JOIN maintenance mt ON n.ref_type = 'MAINTENANCE' AND n.ref_id = mt.id
            LEFT JOIN court mc ON mc.id = mt.court_id
            LEFT JOIN court ct ON n.ref_type = 'COURT' AND n.ref_id = ct.id
            WHERE n.recipient_id = :recipientId AND n.id IN (:ids)
            """, nativeQuery = true)
    List<ReferenceDetails> findReferenceDetails(@Param("recipientId") Long recipientId, @Param("ids") List<Long> ids);

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
