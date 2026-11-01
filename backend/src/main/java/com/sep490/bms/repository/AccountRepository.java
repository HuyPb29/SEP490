package com.sep490.bms.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Role;

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

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByPhoneAndRole(String phone, Role role);

    List<Account> findByRoleAndLocationId(Role role, Long locationId);
}
