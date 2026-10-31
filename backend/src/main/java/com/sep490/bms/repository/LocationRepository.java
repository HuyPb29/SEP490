package com.sep490.bms.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.Location;

@Repository
public interface LocationRepository extends JpaRepository<Location, Long> {

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
