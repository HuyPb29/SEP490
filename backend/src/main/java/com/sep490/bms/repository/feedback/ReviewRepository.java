package com.sep490.bms.repository.feedback;

import java.util.List;

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

    /** Đánh giá công khai của cả địa điểm (mọi sân), cho trang chi tiết cơ sở. */
    Page<Review> findByLocationIdAndHiddenFalse(Long locationId, Pageable pageable);

    /** Số đánh giá công khai theo từng mức sao của địa điểm: mỗi dòng là [rating, count]. */
    @Query("SELECT r.rating, COUNT(r) FROM Review r WHERE r.locationId = :locationId AND r.hidden = false"
            + " GROUP BY r.rating")
    List<Object[]> countVisibleByRating(@Param("locationId") Long locationId);

    @Query("SELECT r FROM Review r WHERE (:locationId IS NULL OR r.locationId = :locationId)"
            + " AND (:rating IS NULL OR r.rating = :rating)"
            + " AND (:hidden IS NULL OR r.hidden = :hidden)")
    Page<Review> search(@Param("locationId") Long locationId, @Param("rating") Integer rating,
            @Param("hidden") Boolean hidden, Pageable pageable);
}
