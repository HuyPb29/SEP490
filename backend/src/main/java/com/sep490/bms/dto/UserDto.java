package com.sep490.bms.dto;

import java.time.LocalDateTime;

import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.AccountStatus;
import com.sep490.bms.entity.Role;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDto {

    private Long id;
    private String username;
    private String email;
    private String phone;
    private String fullName;
    private Role role;
    private String skillLevel;
    private Long locationId;
    private AccountStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static UserDto fromEntity(Account account) {
        if (account == null) {
            return null;
        }
        return UserDto.builder()
                .id(account.getId())
                .username(account.getUsername())
                .email(account.getEmail())
                .phone(account.getPhone())
                .fullName(account.getFullName())
                .role(account.getRole())
                .skillLevel(account.getSkillLevel())
                .locationId(account.getLocationId())
                .status(account.getStatus())
                .createdAt(account.getCreatedAt())
                .updatedAt(account.getUpdatedAt())
                .build();
    }
}
