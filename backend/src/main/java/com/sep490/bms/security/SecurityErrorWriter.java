package com.sep490.bms.security;

import java.io.IOException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.sep490.bms.common.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

/**
 * Ghi phản hồi JSON cho lỗi phát sinh trong bộ lọc xác thực và phân quyền.
 */
@Component
public class SecurityErrorWriter {
    private final ObjectWriter writer;

    public SecurityErrorWriter(ObjectMapper mapper) {
        writer = mapper.writer().without(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    public void write(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        writer.writeValue(response.getOutputStream(), ApiResponse.error(message));
    }
}
