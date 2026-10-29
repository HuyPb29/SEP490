package com.sep490.bms.repository.promotion;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.promotion.Voucher;

@Repository
public interface VoucherRepository extends JpaRepository<Voucher, Long>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<Voucher> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select v from Voucher v where v.id = :id")
    java.util.Optional<Voucher> lockById(@org.springframework.data.repository.query.Param("id") Long id);
    java.util.Optional<Voucher> findByLocationIdAndCode(Long locationId, String code);
    @org.springframework.data.jpa.repository.Query("select v.id from Voucher v where v.locationId = :locationId and v.code = :code")
    java.util.Optional<Long> findIdByLocationAndCode(@org.springframework.data.repository.query.Param("locationId") Long locationId,
            @org.springframework.data.repository.query.Param("code") String code);
    boolean existsByLocationIdAndCode(Long locationId, String code);
}
