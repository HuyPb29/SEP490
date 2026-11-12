package com.sep490.bms.repository.account;

import com.sep490.bms.entity.account.AccountAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * Truy cập nhật ký tài khoản để lưu sự kiện và truy vấn theo bộ lọc của Admin.
 */
public interface AccountAuditRepository extends JpaRepository<AccountAudit, Long>, JpaSpecificationExecutor<AccountAudit> {}
