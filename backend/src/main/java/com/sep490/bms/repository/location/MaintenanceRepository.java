package com.sep490.bms.repository.location;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.Maintenance;

@Repository
public interface MaintenanceRepository extends JpaRepository<Maintenance, Long> {

    /**
     * F2 - UC10, dùng chung với F3 khi tính lịch trống: lấy bảo trì của các sân,
     * theo trạng thái, giao với khoảng nửa mở [startAt, endAt).
     * Điều kiện là maintenance.startAt < endAt và maintenance.endAt > startAt;
     * hai khoảng chỉ chạm đầu/cuối không được coi là giao nhau.
     *
     * Khi gộp AnhVM, giữ duy nhất khai báo này cho query đã có ở cả hai nhánh.
     * Tham số endAt phải đứng trước startAt theo thứ tự StartAtLessThan rồi
     * EndAtGreaterThan trong tên hàm Spring Data, không theo thứ tự thời gian.
     * SlotAvailabilityService truyền dayEnd rồi dayStart theo đúng quy ước này.
     * Đổi tên to/from thành endAt/startAt để rõ nghĩa, không đổi điều kiện query
     * hoặc thứ tự đối số của các nơi gọi. Các query quản lý F2 bên dưới được giữ.
     */
    List<Maintenance> findByCourtIdInAndStatusAndStartAtLessThanAndEndAtGreaterThan(
            Collection<Long> courtIds, ApprovalStatus status, LocalDateTime endAt, LocalDateTime startAt);

    /** F2 - UC10: toàn bộ yêu cầu bảo trì của các sân thuộc một địa điểm, mới nhất trước. */
    List<Maintenance> findAllByCourtIdInOrderByCreatedAtDescIdDesc(Collection<Long> courtIds);

    /** F2 - UC10: như trên nhưng lọc theo trạng thái duyệt. */
    List<Maintenance> findAllByCourtIdInAndStatusOrderByCreatedAtDescIdDesc(
            Collection<Long> courtIds, ApprovalStatus status);

    /**
     * F2 - UC10: các yêu cầu đang chiếm khung giờ của sân (PENDING/APPROVED) và trùng
     * khoảng [startAt, endAt). Dùng để chặn hai yêu cầu bảo trì chồng lên nhau.
     */
    @Query("""
            select m from Maintenance m
            where m.courtId = :courtId
              and m.status in :statuses
              and m.startAt < :endAt
              and m.endAt > :startAt
            """)
    List<Maintenance> findOverlapping(@Param("courtId") Long courtId,
            @Param("statuses") Collection<ApprovalStatus> statuses,
            @Param("startAt") LocalDateTime startAt,
            @Param("endAt") LocalDateTime endAt);
}
