package com.sep490.bms.security;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.LocationRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;

/** Enforces selected-location ownership and locked-location restrictions after authentication. */
@RequiredArgsConstructor
public class LocationScopeFilter extends OncePerRequestFilter {
    private final LocationAccessService locationAccess;
    private final LocationRepository locations;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal user) {
            try {
                checkAccess(request, user);
            } catch (AppException ex) {
                response.sendError(ex.getStatus().value(), ex.getMessage());
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
        boolean export = "GET".equals(request.getMethod()) && path.equals("/api/owner/exports");
        if (!"ACTIVE".equals(location.getStatus()) && !export) {
            throw new AppException("Địa điểm đã bị khóa; chỉ được tải dữ liệu", HttpStatus.FORBIDDEN);
        }
    }
}
