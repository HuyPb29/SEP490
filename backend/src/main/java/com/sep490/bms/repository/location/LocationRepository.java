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
     * Địa điểm đang hoạt động có một từ trong tên hoặc địa chỉ bắt đầu bằng từ khóa (UC11, FR27):
     * {@code prefix} là từ khóa đã escape kèm "%" ở cuối, khớp đầu chuỗi hoặc sau dấu cách
     * ("th" khớp "Thăng Long", không khớp "Sunrise"; "ong" không khớp "Long").
     * So sánh không phân biệt hoa thường và không dấu: "cau long" khớp "Cầu lông".
     * Dùng Latin1_General_CI_AI vì Vietnamese_CI_AI coi chữ có dấu là chữ khác nên không khớp.
     * {@code prefix} null thì lấy tất cả. Khớp tên xếp trước khớp địa chỉ, rồi theo tên.
     */
    @Query(value = "SELECT * FROM location WHERE status = 'ACTIVE' AND (:prefix IS NULL "
            + "OR name COLLATE Latin1_General_CI_AI LIKE :prefix "
            + "OR name COLLATE Latin1_General_CI_AI LIKE CONCAT('% ', :prefix) "
            + "OR address COLLATE Latin1_General_CI_AI LIKE :prefix "
            + "OR address COLLATE Latin1_General_CI_AI LIKE CONCAT('% ', :prefix)) "
            + "ORDER BY CASE WHEN :prefix IS NULL "
            + "OR name COLLATE Latin1_General_CI_AI LIKE :prefix "
            + "OR name COLLATE Latin1_General_CI_AI LIKE CONCAT('% ', :prefix) THEN 0 ELSE 1 END, name",
            nativeQuery = true)
    List<Location> searchActive(@Param("prefix") String prefix);

    /** Địa điểm đang hoạt động; địa điểm đã khóa coi như không tồn tại với Guest/Player (BR62). */
    Optional<Location> findByIdAndStatus(Long id, String status);
}
