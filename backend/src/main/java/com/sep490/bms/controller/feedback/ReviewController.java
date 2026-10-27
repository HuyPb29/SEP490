package com.sep490.bms.controller.feedback;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.feedback.CreateReviewRequest;
import com.sep490.bms.dto.feedback.HideReviewRequest;
import com.sep490.bms.dto.feedback.ReviewReplyRequest;
import com.sep490.bms.dto.feedback.ReviewResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.feedback.ReviewService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Feature: F8 – Đánh giá và khiếu nại
 * Owner: Hoàng
 * UC: UC12 – Xem thông tin sân công khai; UC31 – Đánh giá sân; UC32 – Quản lý đánh giá sân
 * shared with: F3 – Tìm và đặt sân (Minh)
 */
@RestController
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    /** UC12 – đánh giá công khai của sân (không gồm đánh giá bị ẩn). */
    @GetMapping("/api/courts/{id}/reviews")
    public ResponseEntity<ApiResponse<PageResponse<ReviewResponse>>> getCourtsByIdReviews(
            @PathVariable("id") Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.listCourtReviews(id, page, size)));
    }

    /** UC31 – Player đánh giá booking đã hoàn thành. */
    @PostMapping("/api/bookings/{id}/reviews")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<ReviewResponse>> postBookingsByIdReviews(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody CreateReviewRequest request) {
        ReviewResponse review = reviewService.createReview(currentUser.getId(), id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Đánh giá thành công", review));
    }

    /** UC32 – Owner xem đánh giá của địa điểm mình. */
    @GetMapping("/api/owner/reviews")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<PageResponse<ReviewResponse>>> getOwnerReviews(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) Integer rating,
            @RequestParam(required = false) Boolean hidden,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                reviewService.listOwnerReviews(currentUser.getId(), rating, hidden, page, size)));
    }

    /** UC32 – Owner phản hồi đánh giá (một lần). */
    @PostMapping("/api/owner/reviews/{id}/replies")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<ReviewResponse>> postOwnerReviewsByIdReplies(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody ReviewReplyRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã phản hồi đánh giá",
                reviewService.replyReview(currentUser.getId(), id, request)));
    }

    /** UC32 – Admin xem toàn bộ đánh giá. */
    @GetMapping("/api/admin/reviews")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PageResponse<ReviewResponse>>> getAdminReviews(
            @RequestParam(required = false) Long locationId,
            @RequestParam(required = false) Integer rating,
            @RequestParam(required = false) Boolean hidden,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                reviewService.listAdminReviews(locationId, rating, hidden, page, size)));
    }

    /** UC32 – Admin ẩn hoặc hiện lại đánh giá. */
    @PatchMapping("/api/admin/reviews/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ReviewResponse>> patchAdminReviewsById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody HideReviewRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật đánh giá",
                reviewService.setHidden(currentUser.getId(), id, request)));
    }
}
