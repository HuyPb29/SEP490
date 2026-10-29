package com.sep490.bms.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.exception.AppException;
import lombok.RequiredArgsConstructor;

/** SQL Server transaction lock also covers emails with no OTP rows yet. */
@Service
@RequiredArgsConstructor
public class OtpLockService {
    private final JdbcTemplate jdbc;

    @Transactional(propagation = Propagation.MANDATORY)
    public void acquire(String email) {
        String resource;
        try {
            resource = "bms:otp:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(email.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
        // EXEC alone does not begin SQL Server's implicit transaction. A table read
        // does, without introducing a nested BEGIN TRANSACTION on the JDBC connection.
        jdbc.queryForObject("SELECT COUNT(*) FROM otp_request WHERE email = ?", Long.class, email);
        Integer result = jdbc.queryForObject("""
                DECLARE @result int;
                EXEC @result = sys.sp_getapplock @Resource = ?, @LockMode = 'Exclusive',
                    @LockOwner = 'Transaction', @LockTimeout = 10000;
                SELECT @result;
                """, Integer.class, resource);
        if (result == null || result < 0) {
            throw new AppException("Yêu cầu OTP đang được xử lý. Vui lòng thử lại", HttpStatus.TOO_MANY_REQUESTS);
        }
    }
}
