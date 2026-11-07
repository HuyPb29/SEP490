package com.sep490.bms.service.booking;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.booking.BatchOfferPublicResponse;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.location.BatchOffer;
import com.sep490.bms.entity.promotion.Voucher;
import com.sep490.bms.repository.location.BatchOfferRepository;
import com.sep490.bms.repository.promotion.VoucherRepository;
import com.sep490.bms.service.location.LocationQueryService;

import lombok.RequiredArgsConstructor;

/**
 * Đặt nhiều buổi (UC15): gói (booking tổng) gồm nhiều buổi con, thanh toán một lần (BR10, BR26).
 */
@Service
@RequiredArgsConstructor
public class PackageService {

    private final LocationQueryService locationQueryService;
    private final BatchOfferRepository batchOfferRepository;
    private final VoucherRepository voucherRepository;

    /**
     * UC15 #9, FR44: chương trình ưu đãi đặt theo lô đang diễn ra của một địa điểm, công khai.
     * Đang diễn ra = hôm nay nằm trong khoảng ngày của chương trình và voucher tặng còn ở trạng thái
     * đã phát hành (voucher bị vô hiệu hóa thì không tặng được nữa).
     */
    @Transactional(readOnly = true)
    public List<BatchOfferPublicResponse> listActiveBatchOffers(Long locationId) {
        return listActiveBatchOffers(locationId, LocalDate.now());
    }

    List<BatchOfferPublicResponse> listActiveBatchOffers(Long locationId, LocalDate today) {
        locationQueryService.findActive(locationId);
        List<BatchOffer> offers = batchOfferRepository.findAllByLocationIdOrderByStartDateDescIdDesc(locationId)
                .stream()
                .filter(offer -> !today.isBefore(offer.getStartDate()) && !today.isAfter(offer.getEndDate()))
                .toList();
        if (offers.isEmpty()) {
            return List.of();
        }
        Map<Long, Voucher> vouchers = voucherRepository
                .findAllById(offers.stream().map(BatchOffer::getVoucherId).distinct().toList()).stream()
                .collect(Collectors.toMap(Voucher::getId, Function.identity()));
        return offers.stream()
                .filter(offer -> isPublished(vouchers.get(offer.getVoucherId())))
                .sorted(Comparator.comparing(BatchOffer::getStartDate).thenComparing(BatchOffer::getId))
                .map(offer -> BatchOfferPublicResponse.from(offer, vouchers.get(offer.getVoucherId())))
                .toList();
    }

    private static boolean isPublished(Voucher voucher) {
        return voucher != null && voucher.getStatus() == VoucherStatus.PUBLISHED;
    }
}
