package com.sep490.bms.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.UserDto;
import com.sep490.bms.dto.request.UpdateStatusRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.AccountStatus;
import com.sep490.bms.entity.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.security.UserPrincipal;

import jakarta.persistence.criteria.Predicate;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final AccountRepository accountRepository;

    @Transactional(readOnly = true)
    public PageResponse<UserDto> getAccounts(
            int page,
            int size,
            String role,
            String status,
            String search,
            String sortBy,
            String sortDirection) {

        if (page < 0 || size < 1 || size > 100) throw new AppException("Phân trang không hợp lệ");
        if (!List.of("id", "username", "email", "phone", "fullName", "role", "status", "createdAt", "updatedAt").contains(sortBy)) {
            throw new AppException("Trường sắp xếp không hợp lệ");
        }
        if (!List.of("asc", "desc").contains(sortDirection.toLowerCase())) throw new AppException("Chiều sắp xếp không hợp lệ");
        Sort sort = Sort.by("asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC,
                StringUtils.hasText(sortBy) ? sortBy : "id");
        Pageable pageable = PageRequest.of(page, size, sort);

        Specification<Account> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(role)) {
                try {
                    Role r = Role.valueOf(role.trim().toUpperCase());
                    predicates.add(cb.equal(root.get("role"), r));
                } catch (IllegalArgumentException ex) {
                    throw new AppException("Bộ lọc role/status không hợp lệ");
                }
            }

            if (StringUtils.hasText(status)) {
                try {
                    AccountStatus s = AccountStatus.valueOf(status.trim().toUpperCase());
                    predicates.add(cb.equal(root.get("status"), s));
                } catch (IllegalArgumentException ex) {
                    throw new AppException("Bộ lọc role/status không hợp lệ");
                }
            }

            if (StringUtils.hasText(search)) {
                String searchPattern = "%" + search.trim().toLowerCase() + "%";
                Predicate searchPredicate = cb.or(
                        cb.like(cb.lower(root.get("username")), searchPattern),
                        cb.like(cb.lower(root.get("email")), searchPattern),
                        cb.like(cb.lower(root.get("phone")), searchPattern),
                        cb.like(cb.lower(root.get("fullName")), searchPattern)
                );
                predicates.add(searchPredicate);
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Account> accountsPage = accountRepository.findAll(spec, pageable);
        return PageResponse.from(accountsPage.map(UserDto::fromEntity));
    }

    @Transactional
    public UserDto updateAccountStatus(UserPrincipal currentAdmin, Long accountId, UpdateStatusRequest request) {
        if (currentAdmin.getId().equals(accountId)) {
            throw new AppException("Bạn không thể tự thay đổi trạng thái tài khoản của chính mình");
        }

        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(() -> new AppException("Không tìm thấy tài khoản"));

        if (account.getRole() == Role.ADMIN) throw new AppException("Không được thay đổi trạng thái tài khoản Admin");
        AccountStatus newStatus;
        try {
            newStatus = AccountStatus.valueOf(request.getStatus().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("Trạng thái không hợp lệ. Chấp nhận: ACTIVE, LOCKED");
        }

        if (newStatus != AccountStatus.ACTIVE && newStatus != AccountStatus.LOCKED) {
            throw new AppException("Admin chỉ được khóa hoặc mở tài khoản: ACTIVE, LOCKED");
        }

        account.setStatus(newStatus);
        account.setUpdatedAt(LocalDateTime.now());
        Account saved = accountRepository.save(account);

        return UserDto.fromEntity(saved);
    }
}
