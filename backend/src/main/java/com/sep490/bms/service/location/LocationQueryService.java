package com.sep490.bms.service.location;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.dto.location.LocationDetailResponse;
import com.sep490.bms.dto.location.LocationSummaryResponse;
import com.sep490.bms.dto.location.OpeningHourItem;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.location.PriceRule;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.feedback.ReviewRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.repository.location.OpeningHourRepository;
import com.sep490.bms.repository.location.PriceRuleRepository;

import lombok.RequiredArgsConstructor;

/**
 * Phần công khai của địa điểm cho Guest và Player: tìm địa điểm (UC11), xem thông tin địa điểm (UC12).
 * Chỉ đọc địa điểm đang hoạt động; địa điểm đã khóa không hiển thị (BR62).
 */
@Service
@RequiredArgsConstructor
public class LocationQueryService {

    private static final String ACTIVE = "ACTIVE";
    private static final double EARTH_RADIUS_KM = 6371.0;

    private final LocationRepository locationRepository;
    private final OpeningHourRepository openingHourRepository;
    private final CourtRepository courtRepository;
    private final PriceRuleRepository priceRuleRepository;
    private final ReviewRepository reviewRepository;

    /**
     * UC11: tìm theo tên hoặc địa chỉ (FR27). Có vị trí người dùng thì tính km và xếp gần → xa (FR29),
     * không thì xếp theo tên. Vị trí chỉ dùng để tính, không lưu.
     */
    @Transactional(readOnly = true)
    public List<LocationSummaryResponse> search(String q, Double lat, Double lng) {
        boolean hasPosition = validatePosition(lat, lng);
        String pattern = StringUtils.hasText(q) ? "%" + escapeLike(q.trim()) + "%" : null;

        List<Location> locations = locationRepository.searchActive(pattern);
        ListingStats stats = listingStats(locations.stream().map(Location::getId).toList());
        List<LocationSummaryResponse> result = locations.stream()
                .map(l -> toSummary(l, hasPosition ? distanceKm(lat, lng, l) : null, stats))
                .toList();
        if (!hasPosition) {
            return result;
        }
        // Sắp xếp ổn định: cùng khoảng cách thì giữ thứ tự theo tên
        return result.stream().sorted(Comparator.comparing(LocationSummaryResponse::getDistanceKm)).toList();
    }

    /** UC12: thông tin công khai và giờ mở cửa cả tuần (FR30). */
    @Transactional(readOnly = true)
    public LocationDetailResponse detail(Long locationId) {
        Location location = findActive(locationId);
        List<OpeningHourItem> openingHours = openingHourRepository.findAllByLocationIdOrderByDayOfWeek(locationId)
                .stream()
                .map(h -> OpeningHourItem.builder()
                        .dayOfWeek(h.getDayOfWeek())
                        .openTime(MinuteTime.format(h.getOpenMinute()))
                        .closeTime(MinuteTime.format(h.getCloseMinute()))
                        .build())
                .toList();

        return LocationDetailResponse.builder()
                .id(location.getId())
                .name(location.getName())
                .address(location.getAddress())
                .contactPhone(location.getContactPhone())
                .latitude(location.getLatitude())
                .longitude(location.getLongitude())
                .openingHours(openingHours)
                .build();
    }

    /** Địa điểm đang hoạt động; không có hoặc đã khóa thì 404. Service khác của F3 dùng lại. */
    @Transactional(readOnly = true)
    public Location findActive(Long locationId) {
        return locationRepository.findByIdAndStatus(locationId, ACTIVE)
                .orElseThrow(() -> new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));
    }

    /**
     * UC17: địa điểm của các booking trong lịch sử, đọc một lần cho cả trang. Lấy cả địa điểm đã khóa,
     * để booking cũ vẫn hiện tên địa điểm.
     */
    @Transactional(readOnly = true)
    public Map<Long, Location> getByIds(Collection<Long> locationIds) {
        return locationRepository.findAllById(locationIds).stream()
                .collect(Collectors.toMap(Location::getId, Function.identity()));
    }

    // ---------------------------------------------------------------- Hỗ trợ

    /** Phải gửi đủ cả lat và lng, hoặc không gửi cả hai. */
    private boolean validatePosition(Double lat, Double lng) {
        if (lat == null && lng == null) {
            return false;
        }
        if (lat == null || lng == null) {
            throw new AppException("Phải gửi đủ cả vĩ độ (lat) và kinh độ (lng)");
        }
        // Viết theo kiểu "phải nằm trong khoảng": NaN so sánh luôn false nên cũng bị chặn
        if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) {
            throw new AppException("Vị trí không hợp lệ");
        }
        return true;
    }

    /** Khoảng cách đường thẳng theo công thức Haversine, làm tròn 2 chữ số thập phân. */
    private double distanceKm(double lat, double lng, Location location) {
        double lat1 = Math.toRadians(lat);
        double lat2 = Math.toRadians(location.getLatitude().doubleValue());
        double dLat = lat2 - lat1;
        double dLng = Math.toRadians(location.getLongitude().doubleValue() - lng);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double km = 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
        return BigDecimal.valueOf(km).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    /** Ký tự đặc biệt của LIKE trong SQL Server (%, _, [) phải hiểu là chữ thường, không phải ký tự đại diện. */
    private String escapeLike(String keyword) {
        return keyword.replace("[", "[[]").replace("%", "[%]").replace("_", "[_]");
    }

    /** Số sân, giá thấp nhất và đánh giá của các địa điểm trong danh sách; ba truy vấn cho cả trang, không N+1. */
    private ListingStats listingStats(List<Long> locationIds) {
        if (locationIds.isEmpty()) {
            return new ListingStats(Map.of(), Map.of(), Map.of(), Map.of());
        }
        Map<Long, Long> courtLocation = courtRepository.findAllByLocationIdInOrderByNameAsc(locationIds).stream()
                .filter(Court::isActive)
                .collect(Collectors.toMap(Court::getId, Court::getLocationId));
        Map<Long, Integer> courtCounts = courtLocation.values().stream()
                .collect(Collectors.toMap(Function.identity(), id -> 1, Integer::sum));

        Map<Long, BigDecimal> minSlotPrices = new HashMap<>();
        if (!courtLocation.isEmpty()) {
            for (PriceRule rule : priceRuleRepository.findValidOn(courtLocation.keySet(), LocalDate.now())) {
                minSlotPrices.merge(courtLocation.get(rule.getCourtId()), rule.getPricePerSlot(), BigDecimal::min);
            }
        }

        Map<Long, Long> ratingSums = new HashMap<>();
        Map<Long, Long> reviewCounts = new HashMap<>();
        for (Object[] row : reviewRepository.sumVisibleRatingsByLocation(locationIds)) {
            Long locationId = ((Number) row[0]).longValue();
            ratingSums.put(locationId, ((Number) row[1]).longValue());
            reviewCounts.put(locationId, ((Number) row[2]).longValue());
        }
        return new ListingStats(courtCounts, minSlotPrices, ratingSums, reviewCounts);
    }

    private LocationSummaryResponse toSummary(Location l, Double distanceKm, ListingStats stats) {
        BigDecimal minSlotPrice = stats.minSlotPrices().get(l.getId());
        long reviewCount = stats.reviewCounts().getOrDefault(l.getId(), 0L);
        Double averageRating = reviewCount == 0 ? null
                : Math.round(stats.ratingSums().get(l.getId()) * 10.0 / reviewCount) / 10.0;
        return LocationSummaryResponse.builder()
                .id(l.getId())
                .name(l.getName())
                .address(l.getAddress())
                .latitude(l.getLatitude())
                .longitude(l.getLongitude())
                .distanceKm(distanceKm)
                .activeCourtCount(stats.courtCounts().getOrDefault(l.getId(), 0))
                .minPricePerHour(minSlotPrice == null ? null
                        : minSlotPrice.multiply(BigDecimal.valueOf(60 / MinuteTime.SLOT_MINUTES)))
                .averageRating(averageRating)
                .reviewCount(reviewCount)
                .build();
    }

    private record ListingStats(Map<Long, Integer> courtCounts, Map<Long, BigDecimal> minSlotPrices,
            Map<Long, Long> ratingSums, Map<Long, Long> reviewCounts) {
    }
}
