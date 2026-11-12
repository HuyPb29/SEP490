package com.sep490.bms.repository.location;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.LocationSlotSetting;

/**
 * Truy cập cấu hình slot theo địa điểm.
 */
@Repository
public interface LocationSlotSettingRepository extends JpaRepository<LocationSlotSetting, Long> {
}
