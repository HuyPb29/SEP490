package com.sep490.bms.repository.location;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.ServiceTerm;

/**
 * Tra cứu lịch sử kỳ hạn dịch vụ và ngày hết hạn mới nhất của địa điểm.
 */
@Repository
public interface ServiceTermRepository extends JpaRepository<ServiceTerm, Long> {

    /** UC06 - Kỳ hạn dịch vụ của địa điểm, kỳ mới nhất lên đầu. */
    List<ServiceTerm> findAllByLocationIdOrderByStartDateDescIdDesc(Long locationId);

    List<ServiceTerm> findAllByLocationId(Long locationId);

    /**
     * UC07 - Kỳ hạn của nhiều địa điểm trong một truy vấn.
     * Dùng cho danh sách địa điểm của Owner để không phải query N lần.
     */
    List<ServiceTerm> findAllByLocationIdIn(Collection<Long> locationIds);

    /** Một dòng kết quả của truy vấn gom kỳ hạn xa nhất theo địa điểm. */
    interface LatestTermEnd {

        Long getLocationId();

        LocalDate getMaxEndDate();
    }

    /**
     * UC37 - Kỳ hạn xa nhất của từng địa điểm. Địa điểm chỉ bị coi là hết hạn khi
     * kỳ hạn xa nhất đã qua, nên phải gom theo location_id thay vì lấy kỳ bất kỳ.
     */
    @Query("select t.locationId as locationId, max(t.endDate) as maxEndDate"
            + " from ServiceTerm t group by t.locationId")
    List<LatestTermEnd> findLatestEndDateByLocation();
}
