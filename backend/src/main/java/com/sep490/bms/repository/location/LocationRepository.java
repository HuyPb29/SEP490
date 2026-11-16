package com.sep490.bms.repository.location;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.Location;
import jakarta.persistence.LockModeType;

/**
 * Tra cứu địa điểm theo chủ sở hữu, trạng thái và bộ lọc tìm kiếm công khai.
 */
@Repository
public interface LocationRepository extends JpaRepository<Location, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from Location l where l.id = :id")
    Optional<Location> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from Location l where l.id = (select c.locationId from Court c where c.id = :courtId)")
    Optional<Location> findByCourtIdForUpdate(@Param("courtId") Long courtId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select l from Location l where l.id = (
                select c.locationId from Court c join PriceRule p on p.courtId = c.id where p.id = :ruleId)
            """)
    Optional<Location> findByPriceRuleIdForUpdate(@Param("ruleId") Long ruleId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select l from Location l where l.id = (
                select e.locationId from OpeningException e where e.id = :exceptionId)
            """)
    Optional<Location> findByOpeningExceptionIdForUpdate(@Param("exceptionId") Long exceptionId);

    List<Location> findAllByOwnerId(Long ownerId);

    /**
     * Địa điểm đang hoạt động, tên hoặc địa chỉ chứa {@code pattern} (UC11, FR27).
     * So sánh không phân biệt hoa thường và không dấu: "cau long" khớp "Cầu lông", "dong da" khớp "Đống Đa".
     * Dùng Latin1_General_CI_AI vì Vietnamese_CI_AI coi chữ có dấu là chữ khác nên không khớp.
     * {@code pattern} null thì lấy tất cả. Xếp theo tên (collation Vietnamese_CI_AS của database).
     */
    @Query(value = "SELECT * FROM location WHERE status = 'ACTIVE' AND (:pattern IS NULL "
            + "OR name COLLATE Latin1_General_CI_AI LIKE :pattern "
            + "OR address COLLATE Latin1_General_CI_AI LIKE :pattern) ORDER BY name", nativeQuery = true)
    List<Location> searchActive(@Param("pattern") String pattern);

    /** Địa điểm đang hoạt động; địa điểm đã khóa coi như không tồn tại với Guest/Player (BR62). */
    Optional<Location> findByIdAndStatus(Long id, String status);
}
