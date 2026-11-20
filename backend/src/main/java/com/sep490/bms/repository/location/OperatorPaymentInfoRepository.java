package com.sep490.bms.repository.location;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.OperatorPaymentInfo;

/**
 * Đọc, sửa dòng thông tin nhận chuyển khoản duy nhất của bên vận hành (FR127).
 */
@Repository
public interface OperatorPaymentInfoRepository extends JpaRepository<OperatorPaymentInfo, Integer> {
}
