package com.sep490.bms.controller.feedback;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F8 – Đánh giá và khiếu nại
 * Owner: Hoàng
 * UC: UC12 – Xem thông tin sân công khai; UC31 – Đánh giá sân; UC32 – Quản lý đánh giá sân
 * shared with: F3 – Tìm và đặt sân (Minh)
 */
@RestController
public class ReviewController {

    /**
     * UC12 – Xem thông tin sân công khai
     * UC31 – Đánh giá sân
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     * shared with: F3 – Tìm và đặt sân (Minh)
     */
    @GetMapping("/api/courts/{id}/reviews")
    public ResponseEntity<Void> getCourtsByIdReviews(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC31 – Đánh giá sân
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/bookings/{id}/reviews")
    public ResponseEntity<Void> postBookingsByIdReviews(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC32 – Quản lý đánh giá sân
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/reviews")
    public ResponseEntity<Void> getOwnerReviews() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC32 – Quản lý đánh giá sân
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/reviews/{id}/replies")
    public ResponseEntity<Void> postOwnerReviewsByIdReplies(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC32 – Quản lý đánh giá sân
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/admin/reviews")
    public ResponseEntity<Void> getAdminReviews() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC32 – Quản lý đánh giá sân
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/admin/reviews/{id}")
    public ResponseEntity<Void> patchAdminReviewsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** API contract scaffold; business service is not implemented yet. */
    @PatchMapping("/api/owner/reviews/{id}")
    public ResponseEntity<Void> hideOwnerReview(@PathVariable("id") Long id) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
