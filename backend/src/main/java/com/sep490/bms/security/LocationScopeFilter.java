package com.sep490.bms.security;

import java.io.IOException;
import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.LocationRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;

/** Enforces selected-location ownership and locked-location restrictions after authentication. */
@RequiredArgsConstructor
public class LocationScopeFilter extends OncePerRequestFilter {
    /** P29: số ngày Owner của địa điểm bị khóa còn tải được dữ liệu. */
    private static final int LOCKED_EXPORT_DAYS = 30;

    private final LocationAccessService locationAccess;
    private final LocationRepository locations;
    private final SecurityErrorWriter errors;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal user) {
            try {
                checkAccess(request, user);
            } catch (AppException ex) {
                errors.write(response, ex.getStatus(), ex.getMessage());
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private void checkAccess(HttpServletRequest request, UserPrincipal user) {
        if (user.getRole() == Role.STAFF) {
            if (!"ACTIVE".equals(locationAccess.selectedLocation(user).getStatus())) {
                throw new AppException("Địa điểm đã bị khóa", HttpStatus.FORBIDDEN);
            }
            return;
        }
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (user.getRole() != Role.OWNER || !(path.startsWith("/api/owner/") || path.startsWith("/api/staff/"))) {
            return;
        }
        // The location list lets owners select a location, including a locked one for exporting data.
        if (path.equals("/api/owner/locations")) return;

        Location location;
        if (path.matches("/api/owner/locations/[0-9]+(?:/.*)?")) {
            Long id;
            try { id = Long.valueOf(path.split("/")[4]); }
            catch (NumberFormatException ex) { throw new AppException("Mã địa điểm không hợp lệ"); }
            location = locations.findById(id)
                    .orElseThrow(() -> new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));
            if (!user.getId().equals(location.getOwnerId())) {
                throw new AppException("Địa điểm không thuộc Owner", HttpStatus.FORBIDDEN);
            }
        } else {
            location = locationAccess.selectedLocation(user);
        }
        if ("ACTIVE".equals(location.getStatus())) return;
        boolean export = "GET".equals(request.getMethod()) && path.equals("/api/owner/exports");
        if (!export) {
            throw new AppException("Địa điểm đã bị khóa; chỉ được tải dữ liệu", HttpStatus.FORBIDDEN);
        }
        // FR123, BR62: Owner chỉ còn tải được dữ liệu trong P29 ngày kể từ khi địa điểm bị khóa.
        if (location.getLockedAt() != null
                && location.getLockedAt().plusDays(LOCKED_EXPORT_DAYS).isBefore(LocalDateTime.now())) {
            throw new AppException("Đã quá " + LOCKED_EXPORT_DAYS + " ngày kể từ khi địa điểm bị khóa, "
                    + "không thể tải dữ liệu", HttpStatus.FORBIDDEN);
        }
    }
}
