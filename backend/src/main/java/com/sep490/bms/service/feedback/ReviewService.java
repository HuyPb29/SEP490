package com.sep490.bms.service.feedback;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.feedback.CreateReviewRequest;
import com.sep490.bms.dto.feedback.HideReviewRequest;
import com.sep490.bms.dto.feedback.ReviewReplyRequest;
import com.sep490.bms.dto.feedback.ReviewResponse;
import com.sep490.bms.dto.feedback.ReviewSummaryResponse;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.feedback.Review;
import com.sep490.bms.entity.notification.Notification;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.feedback.ReviewRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.notification.NotificationRepository;

import lombok.RequiredArgsConstructor;

/** F8 – UC31 Đánh giá sân, UC32 Quản lý đánh giá sân. */
@Service
@RequiredArgsConstructor
public class ReviewService {

    private static final int MAX_PAGE_SIZE = 50;

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;
    private final CourtRepository courtRepository;
    private final LocationRepository locationRepository;
    private final LocationAccessService locationAccess;
    private final AccountRepository accountRepository;
    private final NotificationRepository notificationRepository;

    // ---------------------------------------------------------------- UC31 – Đánh giá sân

    @Transactional
    public ReviewResponse createReview(Long playerId, Long bookingId, CreateReviewRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException("Không tìm thấy booking", HttpStatus.NOT_FOUND));
        if (!playerId.equals(booking.getPlayerId())) {
            throw new AppException("Bạn chỉ được đánh giá booking của chính mình", HttpStatus.FORBIDDEN);
        }
        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new AppException("Chỉ đánh giá được booking đã hoàn thành");
        }
        if (reviewRepository.existsByBookingId(bookingId)) {
            throw new AppException("Booking này đã được đánh giá", HttpStatus.CONFLICT);
        }

        String comment = request.getComment() == null || request.getComment().isBlank()
                ? null : request.getComment().trim();
        Review review = reviewRepository.save(Review.builder()
                .bookingId(bookingId)
                .locationId(booking.getLocationId())
                .playerId(playerId)
                .rating(request.getRating())
                .comment(comment)
                .build());
        return toResponses(List.of(review)).get(0);
    }

    /** UC12 – danh sách đánh giá công khai (không gồm đánh giá bị ẩn) của một sân. */
    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> listCourtReviews(Long courtId, int page, int size) {
        if (!courtRepository.existsById(courtId)) {
            throw new AppException("Không tìm thấy sân", HttpStatus.NOT_FOUND);
        }
        return toPage(reviewRepository.findVisibleByCourtId(courtId, pageable(page, size)));
    }

    /** UC12 – đánh giá công khai của cả địa điểm, mới nhất lên đầu. */
    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> listLocationReviews(Long locationId, int page, int size) {
        requireLocation(locationId);
        return toPage(reviewRepository.findByLocationIdAndHiddenFalse(locationId, pageable(page, size)));
    }

    /** UC12 – điểm trung bình, tổng số và phân bố số sao của đánh giá công khai tại địa điểm. */
    @Transactional(readOnly = true)
    public ReviewSummaryResponse getLocationReviewSummary(Long locationId) {
        requireLocation(locationId);
        Map<Integer, Long> counts = new TreeMap<>();
        for (int star = 1; star <= 5; star++) {
            counts.put(star, 0L);
        }
        for (Object[] row : reviewRepository.countVisibleByRating(locationId)) {
            counts.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        }
        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        long stars = counts.entrySet().stream().mapToLong(e -> e.getKey() * e.getValue()).sum();
        Double average = total == 0 ? null : Math.round(stars * 10.0 / total) / 10.0;
        return ReviewSummaryResponse.builder()
                .locationId(locationId)
                .averageRating(average)
                .reviewCount(total)
                .ratingCounts(counts)
                .build();
    }

    private void requireLocation(Long locationId) {
        if (!locationRepository.existsById(locationId)) {
            throw new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND);
        }
    }

    // ---------------------------------------------------------------- UC32 – Quản lý đánh giá

    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> listOwnerReviews(UserPrincipal owner, Integer rating, Boolean hidden,
            int page, int size) {
        Location location = findOwnerLocation(owner);
        return toPage(reviewRepository.search(location.getId(), rating, hidden, pageable(page, size)));
    }

    @Transactional
    public ReviewResponse replyReview(UserPrincipal owner, Long reviewId, ReviewReplyRequest request) {
        Review review = findReview(reviewId);
        Location location = findOwnerLocation(owner);
        if (!location.getId().equals(review.getLocationId())) {
            throw new AppException("Đánh giá này không thuộc địa điểm của bạn", HttpStatus.FORBIDDEN);
        }
        if (review.getOwnerReply() != null) {
            throw new AppException("Đánh giá này đã được phản hồi", HttpStatus.CONFLICT);
        }
        review.setOwnerReply(request.getReply().trim());
        reviewRepository.save(review);

        notificationRepository.save(Notification.builder()
                .recipientId(review.getPlayerId())
                .type("REVIEW_REPLIED")
                .title("Chủ sân đã phản hồi đánh giá của bạn")
                .content(truncate(location.getName() + ": " + review.getOwnerReply(), 500))
                .refType("REVIEW")
                .refId(review.getId())
                .build());
        return toResponses(List.of(review)).get(0);
    }

    /** Owner ẩn hoặc hiện lại đánh giá thuộc địa điểm đang chọn của mình. */
    @Transactional
    public ReviewResponse setOwnerHidden(UserPrincipal owner, Long reviewId, HideReviewRequest request) {
        Review review = findReview(reviewId);
        Location location = findOwnerLocation(owner);
        if (!location.getId().equals(review.getLocationId())) {
            throw new AppException("Đánh giá này không thuộc địa điểm của bạn", HttpStatus.FORBIDDEN);
        }
        boolean hide = request.getHidden();
        if (!hide && review.isHidden() && review.getHiddenBy() != null
                && !review.getHiddenBy().equals(owner.getId())) {
            throw new AppException("Đánh giá này do quản trị viên ẩn, bạn không thể hiện lại", HttpStatus.FORBIDDEN);
        }
        review.setHidden(hide);
        review.setHiddenBy(hide ? owner.getId() : null);
        reviewRepository.save(review);
        return toResponses(List.of(review)).get(0);
    }

    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> listAdminReviews(Long locationId, Integer rating, Boolean hidden,
            int page, int size) {
        return toPage(reviewRepository.search(locationId, rating, hidden, pageable(page, size)));
    }

    @Transactional
    public ReviewResponse setHidden(Long adminId, Long reviewId, HideReviewRequest request) {
        Review review = findReview(reviewId);
        boolean hide = request.getHidden();
        review.setHidden(hide);
        review.setHiddenBy(hide ? adminId : null);
        reviewRepository.save(review);
        return toResponses(List.of(review)).get(0);
    }

    // ---------------------------------------------------------------- helpers

    private Review findReview(Long id) {
        return reviewRepository.findById(id)
                .orElseThrow(() -> new AppException("Không tìm thấy đánh giá", HttpStatus.NOT_FOUND));
    }

    private Location findOwnerLocation(UserPrincipal owner) {
        return locationAccess.selectedLocation(owner);
    }

    private Pageable pageable(int page, int size) {
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    private PageResponse<ReviewResponse> toPage(Page<Review> page) {
        return PageResponse.<ReviewResponse>builder()
                .content(toResponses(page.getContent()))
                .pageNumber(page.getNumber())
                .pageSize(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .isLast(page.isLast())
                .build();
    }

    private List<ReviewResponse> toResponses(Collection<Review> reviews) {
        Map<Long, String> playerNames = accountRepository
                .findAllById(reviews.stream().map(Review::getPlayerId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Account::getId, Account::getFullName));
        Map<Long, String> locationNames = locationRepository
                .findAllById(reviews.stream().map(Review::getLocationId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Location::getId, Location::getName));
        return reviews.stream().map(r -> ReviewResponse.builder()
                .id(r.getId())
                .bookingId(r.getBookingId())
                .locationId(r.getLocationId())
                .locationName(locationNames.get(r.getLocationId()))
                .playerId(r.getPlayerId())
                .playerName(playerNames.get(r.getPlayerId()))
                .rating(r.getRating())
                .comment(r.getComment())
                .ownerReply(r.getOwnerReply())
                .hidden(r.isHidden())
                .createdAt(r.getCreatedAt())
                .build()).toList();
    }

    private static String truncate(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max);
    }
}
