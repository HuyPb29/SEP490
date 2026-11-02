package com.sep490.bms.repository.feedback;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.feedback.Review;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long> {

    boolean existsByBookingId(Long bookingId);

    /** Đánh giá công khai (không bị ẩn) của các booking đã đặt trên một sân. */
    @Query("SELECT r FROM Review r, Booking b WHERE r.bookingId = b.id AND b.courtId = :courtId AND r.hidden = false")
    Page<Review> findVisibleByCourtId(@Param("courtId") Long courtId, Pageable pageable);

    @Query("SELECT r FROM Review r WHERE (:locationId IS NULL OR r.locationId = :locationId)"
            + " AND (:rating IS NULL OR r.rating = :rating)"
            + " AND (:hidden IS NULL OR r.hidden = :hidden)")
    Page<Review> search(@Param("locationId") Long locationId, @Param("rating") Integer rating,
            @Param("hidden") Boolean hidden, Pageable pageable);
}
