package com.sep490.bms.service.promotion;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.dto.request.VoucherGrantRequest;
import com.sep490.bms.entity.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.promotion.*;
import com.sep490.bms.repository.*;
import com.sep490.bms.repository.promotion.*;
import com.sep490.bms.security.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.validation.Valid;
import org.springframework.validation.annotation.Validated;
import lombok.RequiredArgsConstructor;

@Service @Validated @RequiredArgsConstructor
@Transactional(readOnly=true)
public class VoucherService {
    private final VoucherRepository vouchers;
    private final VoucherGrantRepository grants;
    private final VoucherUsageRepository usages;
    private final AccountRepository accounts;
    private final LocationRepository locations;
    private final LocationAccessService scope;
    private final EntityManager em;

    private Pageable page(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new AppException("Phân trang không hợp lệ");
        return PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"id"));
    }
    private void role(UserPrincipal user, Role role) {
        if (user == null || user.getRole() != role) throw new AppException("Không có quyền thực hiện",HttpStatus.FORBIDDEN);
    }
    private Long ownerLocation(UserPrincipal user) {
        role(user,Role.OWNER);
        Location l=scope.selectedLocation(user);
        activeLocation(l.getId());
        return l.getId();
    }
    private void activeLocation(Long id) {
        if (locations.findById(id).filter(l -> "ACTIVE".equals(l.getStatus())).isEmpty())
            throw new AppException("Địa điểm không hoạt động",HttpStatus.NOT_FOUND);
    }
    public PageResponse<VoucherResponse> publicList(Long location, int page, int size) {
        activeLocation(location);
        LocalDate today=LocalDate.now();
        return PageResponse.from(vouchers.findAll((r,q,c) -> c.and(
                c.equal(r.get("locationId"),location), c.equal(r.get("status"),VoucherStatus.PUBLISHED),
                c.notEqual(r.get("targetGroup"),VoucherTargetGroup.SPECIFIED),
                c.or(c.isNull(r.get("validFrom")),c.lessThanOrEqualTo(r.get("validFrom"),today)),
                c.or(c.isNull(r.get("validTo")),c.greaterThanOrEqualTo(r.get("validTo"),today)),
                c.or(c.isNull(r.get("maxTotalUses")),c.lessThan(r.get("usedCount"),r.get("maxTotalUses"))),
                c.or(c.isNull(r.get("budget")),c.lessThan(r.get("budgetUsed"),r.get("budget")))) ,page(page,size)).map(VoucherResponse::from));
    }
    public PageResponse<VoucherResponse> ownerList(UserPrincipal user, VoucherStatus status,int page,int size) {
        return list(ownerLocation(user),status,page,size);
    }
    public PageResponse<VoucherResponse> adminList(UserPrincipal user, Long location,VoucherStatus status,int page,int size) {
        role(user,Role.ADMIN); return list(location,status,page,size);
    }
    private PageResponse<VoucherResponse> list(Long location,VoucherStatus status,int page,int size) {
        Specification<Voucher> spec=(r,q,c) -> c.and(location==null ? c.conjunction():c.equal(r.get("locationId"),location),
                status==null ? c.conjunction():c.equal(r.get("status"),status));
        return PageResponse.from(vouchers.findAll(spec,page(page,size)).map(VoucherResponse::from));
    }
    public PageResponse<PersonalVoucherResponse> personalList(UserPrincipal user,int page,int size) {
        role(user,Role.PLAYER);
        return PageResponse.from(grants.findByPlayerId(user.getId(),page(page,size)).map(g -> new PersonalVoucherResponse(
                g.getId(),g.getStatus(),g.getGrantedAt(),g.getExpiresAt(),VoucherResponse.from(vouchers.findById(g.getVoucherId()).orElseThrow()))));
    }
    @Transactional
    public VoucherResponse create(UserPrincipal user,@Valid VoucherWriteRequest request) {
        Voucher v=Voucher.builder().locationId(ownerLocation(user)).source(VoucherSource.CAMPAIGN).build();
        configure(v,request); return VoucherResponse.from(vouchers.saveAndFlush(v));
    }
    private void configure(Voucher v,VoucherWriteRequest r) {
        if(r.validTo().isBefore(LocalDate.now())) throw new AppException("Voucher đã hết hạn");
        String code=r.code()==null ? null:r.code().toUpperCase(Locale.ROOT);
        if(code!=null && !code.equals(v.getCode()) && vouchers.existsByLocationIdAndCode(v.getLocationId(),code))
            throw new AppException("Mã voucher đã tồn tại tại địa điểm",HttpStatus.CONFLICT);
        v.setCode(code); v.setName(r.name().trim()); v.setTargetGroup(r.targetGroup()); v.setDiscountType(r.discountType());
        v.setDiscountValue(r.discountValue()); v.setMinOrderAmount(r.minOrderAmount()); v.setValidFrom(r.validFrom());
        v.setValidTo(r.validTo()); v.setGrantValidDays(r.grantValidDays()); v.setMaxUsesPerPlayer(r.maxUsesPerPlayer());
        v.setMaxTotalUses(r.maxTotalUses()); v.setBudget(r.budget());
    }

}
