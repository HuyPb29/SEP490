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

    /**
     * F2 - UC10, dùng cho F3 (lịch trống): yêu cầu bảo trì theo trạng thái của nhiều sân,
     * trùng khoảng [startAt, endAt). Tham số {@code endAt} đứng trước vì nó gắn với
     * {@code StartAtLessThan}, {@code startAt} gắn với {@code EndAtGreaterThan}.
     */
    List<Maintenance> findByCourtIdInAndStatusAndStartAtLessThanAndEndAtGreaterThan(
            Collection<Long> courtIds, ApprovalStatus status, LocalDateTime endAt, LocalDateTime startAt);
}
