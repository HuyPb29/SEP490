package com.sep490.bms.service.location;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.BatchOfferDto;
import com.sep490.bms.dto.location.CreateBatchOfferRequest;
import com.sep490.bms.dto.location.UpdateBatchOfferRequest;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.location.BatchOffer;
import com.sep490.bms.entity.promotion.Voucher;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.BatchOfferRepository;
import com.sep490.bms.repository.promotion.VoucherRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC09 - Quản lý ưu đãi đặt theo lô (FR19).
 *
 * Mỗi ưu đãi gắn với một voucher của cùng địa điểm: khi tổng giá trị gói đặt sân đạt
 * min_package_amount trong khoảng start_date – end_date thì khách nhận voucher đó.
 * Bảng batch_offer không có cột trạng thái nên "còn hiệu lực" suy ra từ khoảng ngày.
 */
@Service
@RequiredArgsConstructor
public class BatchOfferService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final int NAME_MAX_LENGTH = 100;

    private final BatchOfferRepository batchOfferRepository;
    private final VoucherRepository voucherRepository;
    private final LocationAccessService locationAccessService;
    private final LocationManagementService locationManagementService;

    /** UC09 - Owner xem ưu đãi theo lô của địa điểm đang chọn (header X-Location-Id). */
    @Transactional(readOnly = true)
    public List<BatchOfferDto> list(UserPrincipal user) {
        Location location = locationAccessService.selectedLocation(user);
        List<BatchOffer> offers =
                batchOfferRepository.findAllByLocationIdOrderByStartDateDescIdDesc(location.getId());
        Map<Long, Voucher> vouchers = vouchersOf(offers);
        return offers.stream()
                .map(offer -> BatchOfferDto.fromEntity(offer, vouchers.get(offer.getVoucherId())))
                .toList();
    }

    /** UC09 - Owner tạo ưu đãi đặt theo lô cho địa điểm đang chọn. */
    @Transactional
    public BatchOfferDto create(UserPrincipal user, CreateBatchOfferRequest request) {
        Location location = locationAccessService.selectedLocation(user);
        requireActiveLocation(location, "thêm ưu đãi");

        String name = requireName(request.getName());
        LocalDate startDate = requireDate(request.getStartDate(), "Ngày bắt đầu");
        LocalDate endDate = requireDate(request.getEndDate(), "Ngày kết thúc");
        ensureDateRange(startDate, endDate);
        BigDecimal minAmount = requireAmount(request.getMinPackageAmount());
        Voucher voucher = requireVoucher(location.getId(), request.getVoucherId());

        BatchOffer entity = BatchOffer.builder()
                .locationId(location.getId())
                .name(name)
                .startDate(startDate)
                .endDate(endDate)
                .minPackageAmount(minAmount)
                .voucherId(voucher.getId())
                .build();
        return BatchOfferDto.fromEntity(batchOfferRepository.save(entity), voucher);
    }

    /** UC09 - Owner sửa ưu đãi. Trường null nghĩa là giữ nguyên giá trị hiện tại. */
    @Transactional
    public BatchOfferDto update(UserPrincipal user, Long batchOfferId, UpdateBatchOfferRequest request) {
        BatchOffer entity = requireOffer(batchOfferId);
        Location location = locationManagementService.ownedLocation(user, entity.getLocationId());
        requireActiveLocation(location, "cập nhật ưu đãi");

        if (request.getName() != null) {
            entity.setName(requireName(request.getName()));
        }
        LocalDate startDate = request.getStartDate() == null ? entity.getStartDate() : request.getStartDate();
        LocalDate endDate = request.getEndDate() == null ? entity.getEndDate() : request.getEndDate();
        ensureDateRange(startDate, endDate);
        entity.setStartDate(startDate);
        entity.setEndDate(endDate);

        if (request.getMinPackageAmount() != null) {
            entity.setMinPackageAmount(requireAmount(request.getMinPackageAmount()));
        }

        Voucher voucher;
        if (request.getVoucherId() != null && !request.getVoucherId().equals(entity.getVoucherId())) {
            voucher = requireVoucher(location.getId(), request.getVoucherId());
            entity.setVoucherId(voucher.getId());
        } else {
            voucher = voucherRepository.findById(entity.getVoucherId()).orElse(null);
        }

        return BatchOfferDto.fromEntity(batchOfferRepository.save(entity), voucher);
    }

    /** UC09 - Owner xoá ưu đãi. Nếu ưu đãi đã sinh gói đặt sân thì không xoá được (fk_booking_package_batch_offer_id). */
    @Transactional
    public void delete(UserPrincipal user, Long batchOfferId) {
        BatchOffer entity = requireOffer(batchOfferId);
        Location location = locationManagementService.ownedLocation(user, entity.getLocationId());
        requireActiveLocation(location, "xoá ưu đãi");
        try {
            batchOfferRepository.delete(entity);
            batchOfferRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw new AppException("Ưu đãi đã được dùng trong gói đặt sân nên không thể xoá", HttpStatus.CONFLICT);
        }
    }

    // --------------------------------------------------------------- helpers

    private BatchOffer requireOffer(Long batchOfferId) {
        if (batchOfferId == null || batchOfferId <= 0) {
            throw new AppException("Mã ưu đãi không hợp lệ");
        }
        return batchOfferRepository.findById(batchOfferId)
                .orElseThrow(() -> new AppException("Không tìm thấy ưu đãi", HttpStatus.NOT_FOUND));
    }

    private Map<Long, Voucher> vouchersOf(List<BatchOffer> offers) {
        List<Long> voucherIds = offers.stream()
                .map(BatchOffer::getVoucherId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        if (voucherIds.isEmpty()) {
            return Map.of();
        }
        return voucherRepository.findAllById(voucherIds).stream()
                .collect(Collectors.toMap(Voucher::getId, Function.identity()));
    }

    /** Voucher phải tồn tại, thuộc đúng địa điểm và đã phát hành thì mới gắn vào ưu đãi được. */
    private Voucher requireVoucher(Long locationId, Long voucherId) {
        if (voucherId == null || voucherId <= 0) {
            throw new AppException("Voucher áp dụng không hợp lệ");
        }
        Voucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new AppException("Không tìm thấy voucher", HttpStatus.NOT_FOUND));
        if (!locationId.equals(voucher.getLocationId())) {
            throw new AppException("Voucher không thuộc địa điểm này");
        }
        if (voucher.getStatus() != VoucherStatus.PUBLISHED) {
            throw new AppException("Voucher phải ở trạng thái PUBLISHED trước khi gắn vào ưu đãi");
        }
        return voucher;
    }

    private void requireActiveLocation(Location location, String action) {
        if (!STATUS_ACTIVE.equals(location.getStatus())) {
            throw new AppException("Địa điểm đang bị khoá, không thể " + action, HttpStatus.FORBIDDEN);
        }
    }

    private String requireName(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new AppException("Tên ưu đãi không được để trống");
        }
        if (trimmed.length() > NAME_MAX_LENGTH) {
            throw new AppException("Tên ưu đãi tối đa " + NAME_MAX_LENGTH + " ký tự");
        }
        return trimmed;
    }

    private LocalDate requireDate(LocalDate date, String label) {
        if (date == null) {
            throw new AppException(label + " không được để trống");
        }
        return date;
    }

    /** ck_batch_dates: end_date >= start_date. */
    private void ensureDateRange(LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new AppException("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
        }
    }

    /** ck_batch_amount: min_package_amount > 0. */
    private BigDecimal requireAmount(BigDecimal amount) {
        if (amount == null) {
            throw new AppException("Giá trị gói tối thiểu không được để trống");
        }
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException("Giá trị gói tối thiểu phải lớn hơn 0");
        }
        return amount;
    }
}
