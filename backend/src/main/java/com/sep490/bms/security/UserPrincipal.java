package com.sep490.bms.security;

import java.util.Collection;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.AccountStatus;
import com.sep490.bms.entity.Role;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Builder
public class UserPrincipal implements UserDetails {

    private final Long id;
    private final String username;
    private final String email;
    private final String password;
    private final String fullName;
    private final Role role;
    private final Long locationId;
    private final AccountStatus status;
    private final long tokenVersion;
    private final Collection<? extends GrantedAuthority> authorities;

    public static UserPrincipal create(Account account) {
        List<GrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("ROLE_" + account.getRole().name())
        );

        return UserPrincipal.builder()
                .id(account.getId())
                .username(account.getUsername())
                .email(account.getEmail())
                .password(account.getPasswordHash())
                .fullName(account.getFullName())
                .role(account.getRole())
                .locationId(account.getLocationId())
                .status(account.getStatus())
                .tokenVersion(account.getTokenVersion())
                .authorities(authorities)
                .build();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username != null ? username : email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return status != AccountStatus.LOCKED;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return status == AccountStatus.ACTIVE;
    }
}
