package com.sep490.bms.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.UserDto;
import com.sep490.bms.service.AdminService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/accounts")
    public ResponseEntity<ApiResponse<PageResponse<UserDto>>> getAccounts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection) {
        PageResponse<UserDto> accounts = adminService.getAccounts(page, size, role, status, search, sortBy, sortDirection);
        return ResponseEntity.ok(ApiResponse.success(accounts));
    }
}
