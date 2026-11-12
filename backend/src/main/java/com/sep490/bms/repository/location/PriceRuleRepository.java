package com.sep490.bms.repository.location;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.PriceRule;

/**
 * Tra cứu quy tắc giá theo sân và ngày hiệu lực.
 */
@Repository
public interface PriceRuleRepository extends JpaRepository<PriceRule, Long> {

    /** Mức giá còn hiệu lực vào ngày {@code date}; chưa lọc theo thứ (apply_days). */
    @Query("SELECT p FROM PriceRule p WHERE p.courtId IN :courtIds AND p.validFrom <= :date "
            + "AND (p.validTo IS NULL OR p.validTo >= :date)")
    List<PriceRule> findValidOn(@Param("courtIds") Collection<Long> courtIds, @Param("date") LocalDate date);

    /** Bảng giá của một sân: mức giá chưa hết hạn vào ngày {@code date}, kể cả mức giá sắp có hiệu lực. */
    @Query("SELECT p FROM PriceRule p WHERE p.courtId = :courtId AND (p.validTo IS NULL OR p.validTo >= :date) "
            + "ORDER BY p.validFrom, p.startMinute")
    List<PriceRule> findNotExpired(@Param("courtId") Long courtId, @Param("date") LocalDate date);

    /**
     * F2 - UC09: toàn bộ bảng giá của một sân, sắp theo phút bắt đầu.
     * PriceRuleService dùng danh sách này để quản lý và kiểm tra trùng khung giờ
     * trước khi thêm/sửa; không lọc ngày hiệu lực ngay tại repository.
     *
     * Khi gộp AnhVM, hai nhánh có cùng chữ ký hàm, chỉ khác phần chú thích:
     * giữ một khai báo và bổ sung mục đích sử dụng, không thay hành vi query.
     * Giữ cả findValidOn cho PriceCalculator (giá hiệu lực vào ngày được chọn)
     * và findNotExpired cho CourtQueryService (gồm giá sắp có hiệu lực).
     * Không thay hai query đọc F3 đó bằng query quản lý F2 này vì phạm vi lọc khác nhau.
     */
    List<PriceRule> findAllByCourtIdOrderByStartMinuteAsc(Long courtId);
}
