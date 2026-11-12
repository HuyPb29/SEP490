package com.sep490.bms.repository.account;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.dto.promotion.PointGrantPlayerResponse;

/**
 * Tra cứu tài khoản theo định danh, kiểm tra trùng thông tin và khóa bản ghi khi cập nhật.
 */
@Repository
public interface AccountRepository extends JpaRepository<Account, Long>, JpaSpecificationExecutor<Account> {

    Optional<Account> findByEmail(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.email = :email")
    Optional<Account> findByEmailForUpdate(@Param("email") String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id = :id")
    Optional<Account> findByIdForUpdate(@Param("id") Long id);

    Optional<Account> findByUsername(String username);

    @Query("SELECT a FROM Account a WHERE a.email = :identifier OR a.username = :identifier")
    Optional<Account> findByEmailOrUsername(@Param("identifier") String identifier);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.email = :identifier OR a.username = :identifier")
    Optional<Account> findByEmailOrUsernameForUpdate(@Param("identifier") String identifier);

    List<Account> findByStatusAndLockedUntilLessThanEqual(com.sep490.bms.entity.account.AccountStatus status,java.time.LocalDateTime moment);

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByPhoneAndRole(String phone, Role role);
    boolean existsByPhone(String phone);

    List<Account> findByRoleAndLocationId(Role role, Long locationId);

    @Query("""
            select new com.sep490.bms.dto.promotion.PointGrantPlayerResponse(a.id, a.username, a.fullName)
            from Account a
            where a.role = com.sep490.bms.entity.account.Role.PLAYER
              and a.status = com.sep490.bms.entity.account.AccountStatus.ACTIVE
              and exists (
                  select b.id from Booking b where b.locationId = :locationId and b.playerId = a.id
                    and b.bookingType <> com.sep490.bms.entity.enums.BookingType.WALK_IN
              )
              and (:query = '' or locate(lower(:query), lower(a.fullName)) > 0
                               or locate(lower(:query), lower(a.username)) > 0)
            order by a.fullName, a.id
            """)
    Page<PointGrantPlayerResponse> findPointGrantPlayers(@Param("locationId") Long locationId,
            @Param("query") String query, Pageable pageable);
}
