package com.sep490.bms.repository;

import com.sep490.bms.entity.AccountAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AccountAuditRepository extends JpaRepository<AccountAudit, Long>, JpaSpecificationExecutor<AccountAudit> {}
