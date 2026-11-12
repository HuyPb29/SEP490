package com.sep490.bms.repository.location;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.Court;

/**
 * Tra cứu sân theo địa điểm, tên và trạng thái hoạt động.
 */
@Repository
public interface CourtRepository extends JpaRepository<Court, Long> {

    /** Sân đang bật của một địa điểm; xếp theo id để "Sân 10" không đứng trước "Sân 2". */
    List<Court> findAllByLocationIdAndActiveTrueOrderById(Long locationId);

    Optional<Court> findByIdAndActiveTrue(Long id);
    /**
     * F2 - UC07: sân của một địa điểm.
     * Dùng index của ux_court_name (location_id, name) nên không phát sinh sort.
     */
    List<Court> findAllByLocationIdOrderByNameAsc(Long locationId);

    /** F2 - UC07: kiểm tra trùng tên sân trong cùng một địa điểm. */
    Optional<Court> findByLocationIdAndNameIgnoreCase(Long locationId, String name);

    /**
     * F2 - UC07: sân của nhiều địa điểm trong một câu truy vấn.
     * Dùng cho danh sách địa điểm của Owner để tránh N+1 khi mỗi địa điểm lại
     * phải gọi findAllByLocationIdOrderByNameAsc.
     */
    List<Court> findAllByLocationIdInOrderByNameAsc(Collection<Long> locationIds);
}
