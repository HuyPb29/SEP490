package com.sep490.bms.service.location;

import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.SlotSettingDto;
import com.sep490.bms.dto.location.UpdateSlotSettingRequest;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.LocationSlotSetting;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.LocationSlotSettingRepository;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Cấu hình slot bán sân (FR18).
 *
 * Phạm vi: cấu hình gắn với ĐỊA ĐIỂM, mọi sân con trong cùng địa điểm dùng chung.
 * Vì vậy API vẫn nhận courtId trên path (client đang đứng ở màn hình của một sân),
 * nhưng service tra sân -> địa điểm rồi đọc/ghi cấu hình của địa điểm đó.
 *
 * Chưa có dòng trong bảng nghĩa là đang dùng mặc định 30 phút/slot, nghỉ 0, tối đa 4 slot.
 */
@Service
@RequiredArgsConstructor
public class SlotSettingService {

    private static final int STEP_MINUTES = 30;
    private static final String STATUS_ACTIVE = "ACTIVE";

    private final LocationSlotSettingRepository locationSlotSettingRepository;
    private final CourtManagementService courtManagementService;
    private final LocationManagementService locationManagementService;

    /** UC08 - Xem cấu hình slot của địa điểm chứa sân (trả mặc định nếu chưa cấu hình). */
    @Transactional(readOnly = true)
    public SlotSettingDto get(UserPrincipal user, Long courtId) {
        Court court = courtManagementService.requireCourt(courtId);
        Location location = locationManagementService.ownedLocation(user, court.getLocationId());
        LocationSlotSetting setting = locationSlotSettingRepository.findById(location.getId()).orElse(null);
        return SlotSettingDto.fromEntity(setting, location, court);
    }

    /** UC08 - Owner lưu cấu hình slot cho cả địa điểm. */
    @Transactional
    public SlotSettingDto update(UserPrincipal user, Long courtId, UpdateSlotSettingRequest request) {
        Court court = courtManagementService.requireCourt(courtId);
        Location location = locationManagementService.ownedLocation(user, court.getLocationId());
        requireActiveLocation(location);

        int slotMinutes = requireMultipleOfStep(request.getSlotMinutes(), "Độ dài slot");
        int bufferMinutes = requireMultipleOfStep(request.getBufferMinutes(), "Thời gian nghỉ giữa hai slot");
        Integer maxSlots = request.getMaxSlotsPerBooking();
        if (maxSlots == null) {
            throw new AppException("Số slot tối đa mỗi lần đặt không được để trống");
        }

        LocationSlotSetting setting = locationSlotSettingRepository.findById(location.getId())
                .orElseGet(() -> LocationSlotSetting.builder().locationId(location.getId()).build());
        setting.setSlotMinutes((short) slotMinutes);
        setting.setBufferMinutes((short) bufferMinutes);
        setting.setMaxSlotsPerBooking(maxSlots.shortValue());
        setting.setUpdatedAt(LocalDateTime.now());

        return SlotSettingDto.fromEntity(locationSlotSettingRepository.save(setting), location, court);
    }

    // --------------------------------------------------------------- helpers

    private void requireActiveLocation(Location location) {
        if (!STATUS_ACTIVE.equals(location.getStatus())) {
            throw new AppException("Địa điểm đang bị khoá, không thể cập nhật cấu hình slot",
                    HttpStatus.FORBIDDEN);
        }
    }

    /**
     * Toàn hệ thống chia slot theo bước 30 phút (booking_slot, price_rule, opening_hour),
     * nên cấu hình lẻ phút sẽ làm F3 không sinh được slot.
     */
    private int requireMultipleOfStep(Integer value, String label) {
        if (value == null) {
            throw new AppException(label + " không được để trống");
        }
        if (value % STEP_MINUTES != 0) {
            throw new AppException(label + " phải là bội số của " + STEP_MINUTES + " phút");
        }
        return value;
    }
}
